"""One sync of one knowledge source: build version N+1 next to the live version
N, then swap atomically (see plan.py for the per-page rules)."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from ingest_worker import db
from ingest_worker.chunk import clean_text
from ingest_worker.config import Settings
from ingest_worker.crawl import crawl
from ingest_worker.embed import Embedder
from ingest_worker.enums import KnowledgeSourceType
from ingest_worker.errors import PermanentSyncError, SyncError, TransientSyncError
from ingest_worker.extract_file import extract_file
from ingest_worker.logging_setup import log
from ingest_worker.plan import PageOutcome, StoredPage, plan_version, with_embeddings
from ingest_worker.storage import Storage

# A sync fails (without activating) when more than this share of pages hit
# transient errors, so a site outage never wipes the knowledge base.
MAX_TRANSIENT_SHARE = 0.5


@dataclass
class Deps:
    settings: Settings
    http: httpx.AsyncClient
    embedder: Embedder
    storage: Storage


async def _gather_outcomes(
    deps: Deps, source: db.Source, previous: dict[str, StoredPage]
) -> list[PageOutcome]:
    settings = deps.settings
    if source.type is KnowledgeSourceType.URL:
        assert source.url is not None
        return await crawl(
            deps.http,
            source.url,
            previous,
            follow_links=source.crawl,
            max_pages=settings.max_crawl_pages,
            concurrency=settings.crawl_concurrency,
            request_timeout=settings.fetch_timeout_seconds,
            max_bytes=settings.max_page_bytes,
        )

    if source.type is KnowledgeSourceType.FILE:
        assert source.storage_path is not None and source.file_name is not None
        data = await deps.storage.download(source.storage_path)
        document = await asyncio.to_thread(extract_file, data, source.file_name)
        return [
            PageOutcome(f"file:{source.file_name}", "ok", title=document.title, markdown=document.markdown)
        ]

    text = clean_text(source.text_content or "")
    if not text:
        raise PermanentSyncError("This text source is empty.")
    return [PageOutcome("text", "ok", title=source.title, markdown=text)]


async def sync_source(deps: Deps, conn: db.Conn, job: db.Job, *, final_attempt: bool) -> None:
    source = await db.load_source(conn, job.source_id)
    if source is None:
        log.info("sync.skipped.source_deleted", source_id=str(job.source_id))
        return

    bound = log.bind(source_id=str(source.id), site_id=str(source.site_id), job_id=str(job.id))
    version = source.active_version + 1
    bound.info("sync.started", version=version, type=source.type.value, kind=job.kind.value)
    await db.mark_processing(conn, source)

    previous = await db.load_previous_pages(conn, source)
    outcomes = await _gather_outcomes(deps, source, previous)

    model = deps.embedder.model
    cache = await db.load_embedding_cache(conn, source.id, model) if deps.embedder.enabled else {}
    plan = plan_version(
        outcomes,
        previous,
        cache,
        model,
        datetime.now(UTC),
        chunk_page_urls=source.type is KnowledgeSourceType.URL,
    )

    if plan.attempted and plan.transient_failures / plan.attempted > MAX_TRANSIENT_SHARE:
        raise TransientSyncError(
            "Most pages couldn't be reached. We'll keep using the previous version and try again shortly."
        )
    if not plan.chunks:
        raise PermanentSyncError("No readable text was found. Check that the page or file has text content.")

    other_chunks = await db.count_other_active_chunks(conn, source.site_id, source.id)
    if other_chunks + len(plan.chunks) > deps.settings.max_chunks_per_site:
        raise PermanentSyncError(
            f"This would exceed the {deps.settings.max_chunks_per_site:,}-passage limit for a site. "
            "Remove some sources or turn off crawling for this link."
        )

    missing = plan.missing_embeddings
    if missing and deps.embedder.enabled:
        try:
            vectors = await deps.embedder.embed_documents([plan.chunks[i].embedding_input for i in missing])
            plan = with_embeddings(plan, dict(zip(missing, vectors, strict=True)), model)
        except SyncError:
            if not final_attempt:
                raise
            # Last attempt: keep the content searchable by full-text; the next
            # sync fills in the missing embeddings.
            bound.warning("sync.embeddings_skipped", missing=len(missing))

    await db.write_and_activate(conn, source, version, plan)
    bound.info(
        "sync.activated",
        version=version,
        pages=len(plan.pages),
        chunks=len(plan.chunks),
        changed_pages=plan.changed_pages,
        reused_pages=plan.reused_pages,
        stale_pages=plan.transient_failures,
        embedded=len(missing) if deps.embedder.enabled else 0,
    )

    if deps.embedder.enabled:
        conflicts = await db.detect_conflicts(conn, source.id, deps.settings.conflict_threshold)
        if conflicts:
            bound.info("sync.conflicts_found", count=conflicts)

    if source.replaced_storage_path:
        try:
            await deps.storage.delete([source.replaced_storage_path])
            await db.clear_replaced_file(conn, source.id, source.replaced_storage_path)
        except httpx.HTTPError:
            bound.warning("sync.replaced_file_cleanup_failed")
