"""Integration tests against Postgres + pgvector with every repo migration applied.

Set TEST_DATABASE_URL to a server where the test user can create databases, e.g.
    TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres uv run pytest
Each test module run creates (and drops) a throwaway database.
"""

import asyncio
import hashlib
import os
import subprocess
import uuid
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx
import psycopg
import pytest
import respx
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from ingest_worker import db, safe_fetch
from ingest_worker.config import Settings
from ingest_worker.embed import Embedder, to_pgvector
from ingest_worker.enums import PG_ENUMS
from ingest_worker.errors import PermanentSyncError, TransientSyncError
from ingest_worker.pipeline import Deps, sync_source
from ingest_worker.storage import Storage

ADMIN_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not ADMIN_URL, reason="TEST_DATABASE_URL is not set")
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "apply-migrations.sh"
DIMS = 1024


@pytest.fixture(scope="module")
def database_url() -> Iterator[str]:
    assert ADMIN_URL
    name = f"crolyo_test_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(f'create database "{name}"')
    parts = urlsplit(ADMIN_URL)
    url = urlunsplit((parts.scheme, parts.netloc, f"/{name}", parts.query, ""))
    subprocess.run([str(SCRIPT)], env={**os.environ, "DATABASE_URL": url}, check=True, capture_output=True)
    yield url
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(f'drop database "{name}" with (force)')


@pytest.fixture
async def conn(database_url: str) -> AsyncIterator[db.Conn]:
    async with await AsyncConnection.connect(
        database_url, autocommit=True, row_factory=dict_row
    ) as connection:
        # The queue is global; isolate each test's jobs.
        await connection.execute("delete from public.knowledge_jobs")
        yield connection


class FakeEmbedder(Embedder):
    """Deterministic vectors derived from the text; records every call."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        super().__init__(settings, client)
        self.calls: list[list[str]] = []

    async def embed_documents(self, texts: list[str]) -> list[str]:
        self.calls.append(texts)
        return [vector_for(text) for text in texts]


def vector_for(text: str) -> str:
    seed = hashlib.sha256(text.encode()).digest()
    values = [((seed[i % len(seed)] / 255.0) - 0.5) for i in range(DIMS)]
    return to_pgvector(values)


@pytest.fixture
async def deps(settings: Settings) -> AsyncIterator[Deps]:
    settings.embedding_dimensions = DIMS
    async with httpx.AsyncClient() as client:
        yield Deps(settings, client, FakeEmbedder(settings, client), Storage(settings, client))


async def make_site(conn: db.Conn) -> uuid.UUID:
    auth_id = uuid.uuid4()
    await conn.execute(
        "insert into auth.users (id, email) values (%s, %s)", (auth_id, f"{auth_id}@example.com")
    )
    cursor = await conn.execute(
        "insert into public.sites (user_id, name) "
        "select id, 'Acme' from public.users where auth_user_id = %s "
        "returning id",
        (auth_id,),
    )
    row = await cursor.fetchone()
    assert row is not None
    return uuid.UUID(str(row["id"]))


async def add_text_source(conn: db.Conn, site_id: uuid.UUID, title: str, text: str) -> uuid.UUID:
    cursor = await conn.execute(
        "insert into public.knowledge_sources (site_id, type, title, text_content) "
        "values (%s, 'text', %s, %s) "
        "returning id",
        (site_id, title, text),
    )
    row = await cursor.fetchone()
    assert row is not None
    return uuid.UUID(str(row["id"]))


async def enqueue(conn: db.Conn, source_id: uuid.UUID) -> None:
    await conn.execute("select public.enqueue_knowledge_job(%s)", (source_id,))


async def claim(conn: db.Conn, worker: str = "w1") -> db.Job:
    job = await db.claim_job(conn, worker, 300, 3)
    assert job is not None
    return job


async def run_sync(deps: Deps, conn: db.Conn, source_id: uuid.UUID) -> db.Job:
    await enqueue(conn, source_id)
    job = await claim(conn)
    assert job.source_id == source_id
    await sync_source(deps, conn, job, final_attempt=False)
    await db.complete_job(conn, job, "w1")
    return job


async def match(conn: db.Conn, site_id: uuid.UUID, query: str, embedding: str | None = None) -> list[dict]:
    cursor = await conn.execute(
        "select * from public.match_knowledge_chunks(%s, %s, %s::extensions.vector, %s, 8)",
        (site_id, query, embedding, "voyageai/voyage-4-large" if embedding else None),
    )
    return list(await cursor.fetchall())


async def source_row(conn: db.Conn, source_id: uuid.UUID) -> dict:
    cursor = await conn.execute("select * from public.knowledge_sources where id = %s", (source_id,))
    row = await cursor.fetchone()
    assert row is not None
    return dict(row)


FAQ = (
    "## Shipping\nWe ship to over 40 countries.\n\n"
    "## Refunds\nRefunds are available within 30 days of purchase."
)


async def test_python_enum_mirrors_match_postgres(conn: db.Conn) -> None:
    for name, enum_class in PG_ENUMS.items():
        cursor = await conn.execute(
            "select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid "
            "where t.typname = %s order by e.enumsortorder",
            (name,),
        )
        labels = [row["enumlabel"] for row in await cursor.fetchall()]
        assert labels == [member.value for member in enum_class], name


async def test_text_source_sync_then_edit_reindexes_only_changed_chunks(deps: Deps, conn: db.Conn) -> None:
    site_id = await make_site(conn)
    source_id = await add_text_source(conn, site_id, "FAQ", FAQ)
    embedder = deps.embedder
    assert isinstance(embedder, FakeEmbedder)

    await run_sync(deps, conn, source_id)
    row = await source_row(conn, source_id)
    assert row["active_version"] == 1 and row["status"] == "ready" and row["chunk_count"] == 2
    assert sum(len(call) for call in embedder.calls) == 2
    hits = await match(conn, site_id, "what is your refund policy?")
    assert hits and "30 days" in hits[0]["content"]

    # Edit one paragraph: version 2, only the changed chunk is embedded, old version gone.
    embedder.calls.clear()
    await conn.execute(
        "update public.knowledge_sources set text_content = %s where id = %s",
        (FAQ.replace("30 days", "14 days"), source_id),
    )
    await run_sync(deps, conn, source_id)
    row = await source_row(conn, source_id)
    assert row["active_version"] == 2 and row["chunk_count"] == 2
    assert sum(len(call) for call in embedder.calls) == 1
    cursor = await conn.execute(
        "select distinct version from public.knowledge_chunks where source_id = %s", (source_id,)
    )
    assert [r["version"] for r in await cursor.fetchall()] == [2]
    contents = " ".join(hit["content"] for hit in await match(conn, site_id, "refund days"))
    assert "14 days" in contents and "30 days" not in contents

    # Unchanged re-sync: no embedding calls at all.
    embedder.calls.clear()
    await run_sync(deps, conn, source_id)
    assert embedder.calls == []
    assert (await source_row(conn, source_id))["active_version"] == 3


async def test_vector_search_and_cross_source_dedupe(deps: Deps, conn: db.Conn) -> None:
    site_id = await make_site(conn)
    first = await add_text_source(conn, site_id, "FAQ", FAQ)
    second = await add_text_source(conn, site_id, "FAQ", FAQ)  # identical content
    await run_sync(deps, conn, first)
    await run_sync(deps, conn, second)

    hits = await match(conn, site_id, "shipping countries")
    assert len({hit["content"] for hit in hits}) == len(hits)  # deduplicated by content hash
    query_vector = vector_for("FAQ > Shipping\n\nWe ship to over 40 countries.")
    vector_hits = await match(conn, site_id, "zzz unrelated", query_vector)
    assert vector_hits and vector_hits[0]["title"] == "FAQ > Shipping"


async def test_conflicts_between_sources_are_flagged(deps: Deps, conn: db.Conn) -> None:
    site_id = await make_site(conn)
    first = await add_text_source(
        conn, site_id, "Old pricing", "## Pro plan\nThe Pro plan costs $29 per month."
    )
    second = await add_text_source(
        conn, site_id, "New pricing", "## Pro plan\nThe Pro plan costs $39 per month."
    )
    # Make both embed to the same vector so they look like the same topic.
    embedder = deps.embedder
    assert isinstance(embedder, FakeEmbedder)

    async def same_topic(texts: list[str]) -> list[str]:
        return [vector_for("pro plan pricing") for _ in texts]

    embedder.embed_documents = same_topic  # type: ignore[method-assign]
    await run_sync(deps, conn, first)
    await run_sync(deps, conn, second)
    cursor = await conn.execute(
        "select count(*) as n from public.knowledge_conflicts where site_id = %s", (site_id,)
    )
    row = await cursor.fetchone()
    assert row is not None and row["n"] >= 1


async def test_claims_are_exclusive_and_expired_leases_are_recovered(
    conn: db.Conn, database_url: str
) -> None:
    site_id = await make_site(conn)
    source_id = await add_text_source(conn, site_id, "FAQ", FAQ)
    await enqueue(conn, source_id)

    async def try_claim(worker: str) -> db.Job | None:
        async with await AsyncConnection.connect(
            database_url, autocommit=True, row_factory=dict_row
        ) as other:
            return await db.claim_job(other, worker, 300, 3)

    results = await asyncio.gather(try_claim("a"), try_claim("b"))
    claimed = [job for job in results if job is not None]
    assert len(claimed) == 1

    # Simulate a crashed worker: expire the lease, and another worker re-claims it.
    await conn.execute("update public.knowledge_jobs set locked_until = now() - interval '1 second'")
    again = await db.claim_job(conn, "c", 300, 3)
    assert again is not None and again.id == claimed[0].id and again.attempts == 2


async def test_enqueue_during_a_run_requeues_after_completion(conn: db.Conn) -> None:
    site_id = await make_site(conn)
    source_id = await add_text_source(conn, site_id, "FAQ", FAQ)
    await enqueue(conn, source_id)
    job = await claim(conn)
    await enqueue(conn, source_id)  # e.g. the owner edits while a sync runs
    await db.complete_job(conn, job, "w1")
    cursor = await conn.execute("select status, attempts from public.knowledge_jobs where id = %s", (job.id,))
    row = await cursor.fetchone()
    assert row is not None and row["status"] == "queued" and row["attempts"] == 0


async def test_retryable_failures_back_off_then_fail_the_source(conn: db.Conn) -> None:
    site_id = await make_site(conn)
    source_id = await add_text_source(conn, site_id, "FAQ", FAQ)
    await enqueue(conn, source_id)
    job = await claim(conn)
    assert await db.fail_job(conn, job, "w1", "Temporary problem", retryable=True, max_attempts=3)
    cursor = await conn.execute("select status, run_after > now() as delayed from public.knowledge_jobs")
    row = await cursor.fetchone()
    assert row is not None and row["status"] == "queued" and row["delayed"]

    await conn.execute("update public.knowledge_jobs set run_after = now(), attempts = 3")
    job = await claim(conn)
    assert not await db.fail_job(conn, job, "w1", "Still broken", retryable=True, max_attempts=3)
    source = await source_row(conn, source_id)
    assert source["status"] == "failed" and source["error"] == "Still broken"


@pytest.fixture
def public_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    async def resolve(host: str, port: int) -> list[str]:
        return ["93.184.216.34"]

    monkeypatch.setattr(safe_fetch, "resolve_addresses", resolve)


PAGE = (
    "<html><head><title>Help</title></head><body><main><article><h1>Help</h1>"
    "<p>Our support team answers every message within one business day, Monday through Friday.</p>"
    "</article></main></body></html>"
)


@respx.mock
async def test_site_outage_keeps_the_previous_version(deps: Deps, conn: db.Conn, public_dns: None) -> None:
    site_id = await make_site(conn)
    cursor = await conn.execute(
        "insert into public.knowledge_sources (site_id, type, title, url, sync_interval_hours) "
        "values (%s, 'url', 'help', 'https://acme.com/help', 24) returning id",
        (site_id,),
    )
    row = await cursor.fetchone()
    assert row is not None
    source_id = uuid.UUID(str(row["id"]))

    respx.get("https://acme.com/help").mock(
        return_value=httpx.Response(200, html=PAGE, headers={"etag": '"1"'})
    )
    await run_sync(deps, conn, source_id)
    assert (await source_row(conn, source_id))["active_version"] == 1

    respx.get("https://acme.com/help").mock(return_value=httpx.Response(503))
    await enqueue(conn, source_id)
    job = await claim(conn)
    with pytest.raises(TransientSyncError):
        await sync_source(deps, conn, job, final_attempt=False)
    source = await source_row(conn, source_id)
    assert source["active_version"] == 1
    hits = await match(conn, site_id, "support business day")
    assert hits, "the previous version must keep serving"


@respx.mock
async def test_unreachable_start_page_on_first_sync_fails_permanently(
    deps: Deps, conn: db.Conn, public_dns: None
) -> None:
    site_id = await make_site(conn)
    cursor = await conn.execute(
        "insert into public.knowledge_sources (site_id, type, title, url) "
        "values (%s, 'url', 'x', 'https://acme.com/private') returning id",
        (site_id,),
    )
    row = await cursor.fetchone()
    assert row is not None
    respx.get("https://acme.com/private").mock(return_value=httpx.Response(401))
    await enqueue(conn, uuid.UUID(str(row["id"])))
    job = await claim(conn)
    with pytest.raises(PermanentSyncError):
        await sync_source(deps, conn, job, final_attempt=False)
