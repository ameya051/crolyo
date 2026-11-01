"""Queries and RPC calls. Connections are autocommit; multi-statement writes use
explicit transactions."""

from dataclasses import dataclass
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import DictRow

from ingest_worker.enums import KnowledgeJobKind, KnowledgeSourceType
from ingest_worker.plan import StoredChunk, StoredPage, VersionPlan

Conn = AsyncConnection[DictRow]

# Delay before retry N (1-based attempts already made).
RETRY_BACKOFF_SECONDS = [60, 300, 1800]


@dataclass
class Job:
    id: UUID
    source_id: UUID
    kind: KnowledgeJobKind
    attempts: int


@dataclass
class Source:
    id: UUID
    site_id: UUID
    type: KnowledgeSourceType
    title: str
    url: str | None
    crawl: bool
    storage_path: str | None
    replaced_storage_path: str | None
    file_name: str | None
    text_content: str | None
    active_version: int
    sync_interval_hours: int | None


async def claim_job(conn: Conn, worker_id: str, lease_seconds: int, max_attempts: int) -> Job | None:
    cursor = await conn.execute(
        "select id, source_id, kind, attempts from public.claim_knowledge_job(%s, %s, %s)",
        (worker_id, lease_seconds, max_attempts),
    )
    row = await cursor.fetchone()
    if row is None:
        return None
    return Job(row["id"], row["source_id"], KnowledgeJobKind(row["kind"]), row["attempts"])


async def renew_lease(conn: Conn, job_id: UUID, worker_id: str, lease_seconds: int) -> bool:
    cursor = await conn.execute(
        """
        update public.knowledge_jobs
           set locked_until = now() + make_interval(secs => %s), updated_at = now()
         where id = %s and locked_by = %s and status = 'running'
        """,
        (lease_seconds, job_id, worker_id),
    )
    return cursor.rowcount == 1


async def complete_job(conn: Conn, job: Job, worker_id: str) -> None:
    """Marks the job done, or re-queues it when a re-run was requested mid-flight."""
    cursor = await conn.execute(
        """
        update public.knowledge_jobs
           set status = (
                 case when rerun_requested then 'queued' else 'done' end
               )::public.knowledge_job_status,
               attempts = case when rerun_requested then 0 else attempts end,
               finished_at = case when rerun_requested then null else now() end,
               run_after = now(),
               rerun_requested = false,
               locked_by = null,
               locked_until = null,
               error = null,
               updated_at = now()
         where id = %s and locked_by = %s
        returning status
        """,
        (job.id, worker_id),
    )
    row = await cursor.fetchone()
    if row is not None and row["status"] == "queued":
        await conn.execute("select pg_notify('knowledge_jobs', %s)", (str(job.id),))


async def fail_job(
    conn: Conn, job: Job, worker_id: str, message: str, *, retryable: bool, max_attempts: int
) -> bool:
    """Retries with backoff while attempts remain; otherwise fails the job and
    the source. Returns True if the job will be retried."""
    async with conn.transaction():
        cursor = await conn.execute(
            "select rerun_requested from public.knowledge_jobs where id = %s and locked_by = %s for update",
            (job.id, worker_id),
        )
        row = await cursor.fetchone()
        if row is None:
            return False  # lease lost; another worker owns the job now

        if row["rerun_requested"] or (retryable and job.attempts < max_attempts):
            delay = 0 if row["rerun_requested"] else RETRY_BACKOFF_SECONDS[min(job.attempts, 3) - 1]
            await conn.execute(
                """
                update public.knowledge_jobs
                   set status = 'queued',
                       attempts = case when rerun_requested then 0 else attempts end,
                       rerun_requested = false,
                       run_after = now() + make_interval(secs => %s),
                       locked_by = null, locked_until = null, error = %s, updated_at = now()
                 where id = %s
                """,
                (delay, message, job.id),
            )
            return True

        await conn.execute(
            """
            update public.knowledge_jobs
               set status = 'failed', locked_by = null, locked_until = null, error = %s,
                   finished_at = now(), updated_at = now()
             where id = %s
            """,
            (message, job.id),
        )
        await conn.execute(
            """
            update public.knowledge_sources
               set status = 'failed', error = %s, updated_at = now(),
                   next_sync_at = case when type = 'url' and sync_interval_hours is not null
                                       then now() + make_interval(hours => sync_interval_hours) end
             where id = %s
            """,
            (message, job.source_id),
        )
        return False


async def release_job(conn: Conn, job: Job, worker_id: str) -> None:
    """Hands a job back on shutdown without counting the interrupted attempt."""
    await conn.execute(
        """
        update public.knowledge_jobs
           set status = 'queued', locked_by = null, locked_until = null,
               attempts = greatest(attempts - 1, 0), run_after = now(), updated_at = now()
         where id = %s and locked_by = %s and status = 'running'
        """,
        (job.id, worker_id),
    )


async def load_source(conn: Conn, source_id: UUID) -> Source | None:
    cursor = await conn.execute(
        """
        select id, site_id, type, title, url, crawl, storage_path, replaced_storage_path, file_name,
               text_content, active_version, sync_interval_hours
          from public.knowledge_sources where id = %s
        """,
        (source_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        return None
    return Source(**{**row, "type": KnowledgeSourceType(row["type"])})


async def mark_processing(conn: Conn, source: Source) -> None:
    await conn.execute(
        "update public.knowledge_sources set status = 'processing', updated_at = now() where id = %s",
        (source.id,),
    )
    # Clean up rows from an earlier attempt that never activated.
    await conn.execute(
        "delete from public.knowledge_chunks where source_id = %s and version > %s",
        (source.id, source.active_version),
    )
    await conn.execute(
        "delete from public.knowledge_pages where source_id = %s and version > %s",
        (source.id, source.active_version),
    )


async def load_previous_pages(conn: Conn, source: Source) -> dict[str, StoredPage]:
    if source.active_version == 0:
        return {}
    cursor = await conn.execute(
        """
        select url, title, etag, last_modified, content_hash, links, stale_since
          from public.knowledge_pages where source_id = %s and version = %s
        """,
        (source.id, source.active_version),
    )
    pages = {
        row["url"]: StoredPage(
            row["url"],
            row["title"],
            row["etag"],
            row["last_modified"],
            row["content_hash"],
            list(row["links"] or []),
            row["stale_since"],
        )
        for row in await cursor.fetchall()
    }
    cursor = await conn.execute(
        """
        select p.url as page_key, c.page_url, c.title, c.content, c.content_hash,
               c.embedding::text as embedding, c.embedding_model
          from public.knowledge_chunks c
          join public.knowledge_pages p
            on p.source_id = c.source_id and p.version = c.version
           and p.url = coalesce(c.page_url, p.url)
         where c.source_id = %s and c.version = %s
         order by c.chunk_index
        """,
        (source.id, source.active_version),
    )
    for row in await cursor.fetchall():
        page = pages.get(row["page_key"])
        if page is not None:
            page.chunks.append(
                StoredChunk(
                    row["page_url"],
                    row["title"],
                    row["content"],
                    row["content_hash"],
                    row["embedding"],
                    row["embedding_model"],
                )
            )
    return pages


async def load_embedding_cache(conn: Conn, source_id: UUID, model: str) -> dict[str, str]:
    cursor = await conn.execute(
        """
        select distinct on (content_hash) content_hash, embedding::text as embedding
          from public.knowledge_chunks
         where source_id = %s and embedding_model = %s and embedding is not null
        """,
        (source_id, model),
    )
    return {row["content_hash"]: row["embedding"] for row in await cursor.fetchall()}


async def count_other_active_chunks(conn: Conn, site_id: UUID, source_id: UUID) -> int:
    cursor = await conn.execute(
        """
        select count(*) as total
          from public.knowledge_chunks c
          join public.knowledge_sources s on s.id = c.source_id and c.version = s.active_version
         where c.site_id = %s and c.source_id <> %s
        """,
        (site_id, source_id),
    )
    row = await cursor.fetchone()
    return int(row["total"]) if row else 0


async def write_and_activate(conn: Conn, source: Source, version: int, plan: VersionPlan) -> None:
    """Inserts the new version and makes it live in one transaction."""
    async with conn.transaction():
        async with conn.cursor() as cursor:
            await cursor.executemany(
                """
                insert into public.knowledge_pages
                  (source_id, version, url, title, etag, last_modified, content_hash, links,
                   last_status, stale_since)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        source.id,
                        version,
                        p.url,
                        p.title,
                        p.etag,
                        p.last_modified,
                        p.content_hash,
                        p.links,
                        p.last_status,
                        p.stale_since,
                    )
                    for p in plan.pages
                ],
            )
            await cursor.executemany(
                """
                insert into public.knowledge_chunks
                  (source_id, site_id, version, page_url, title, content, chunk_index, content_hash,
                   embedding, embedding_model)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector, %s)
                """,
                [
                    (
                        source.id,
                        source.site_id,
                        version,
                        c.page_url,
                        c.title,
                        c.content,
                        c.chunk_index,
                        c.content_hash,
                        c.embedding,
                        c.embedding_model,
                    )
                    for c in plan.chunks
                ],
            )
        await conn.execute("select public.activate_source_version(%s, %s)", (source.id, version))


async def detect_conflicts(conn: Conn, source_id: UUID, threshold: float) -> int:
    cursor = await conn.execute(
        "select public.detect_knowledge_conflicts(%s, %s::real) as found", (source_id, threshold)
    )
    row = await cursor.fetchone()
    return int(row["found"]) if row else 0


async def clear_replaced_file(conn: Conn, source_id: UUID, path: str) -> None:
    await conn.execute(
        """
        update public.knowledge_sources set replaced_storage_path = null
         where id = %s and replaced_storage_path = %s
        """,
        (source_id, path),
    )


async def enqueue_due_syncs(conn: Conn) -> int:
    """Queues scheduled re-crawls for URL sources that are due and idle."""
    cursor = await conn.execute(
        """
        select public.enqueue_knowledge_job(s.id, 'sync')
          from public.knowledge_sources s
         where s.type = 'url'
           and s.sync_interval_hours is not null
           and s.next_sync_at <= now()
           and not exists (
             select 1 from public.knowledge_jobs j
              where j.source_id = s.id and j.status in ('queued', 'running')
           )
        """
    )
    return len(await cursor.fetchall())


async def enqueue_reembed_all(conn: Conn, model: str) -> int:
    """Queues re-embedding for sources with chunks missing the current model's embeddings."""
    cursor = await conn.execute(
        """
        select public.enqueue_knowledge_job(s.id, 'reembed')
          from public.knowledge_sources s
         where exists (
           select 1 from public.knowledge_chunks c
            where c.source_id = s.id and c.version = s.active_version
              and (c.embedding is null or c.embedding_model is distinct from %s)
         )
        """,
        (model,),
    )
    return len(await cursor.fetchall())
