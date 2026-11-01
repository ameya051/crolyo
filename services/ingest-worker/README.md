# Ingest worker

Turns knowledge sources (web links, uploaded documents, pasted text) into
searchable, embedded chunks for the Crolyo AI agent. It is a long-running
Python process that takes jobs from a queue table in Supabase Postgres.

```
Next.js dashboard ── enqueue_knowledge_job() ──> knowledge_jobs ──NOTIFY──> worker
worker: fetch (SSRF-safe) -> extract -> chunk -> hash -> plan N+1 -> embed new chunks -> activate
```

## How syncing works

- **Versioned and atomic.** Each sync builds version N+1 next to the live
  version N, then `activate_source_version()` swaps it in one transaction. The
  agent never sees half-updated content or old and new copies of a chunk side
  by side. A failed sync leaves version N serving.
- **Cheap re-syncs.** Pages are fetched with `If-None-Match` /
  `If-Modified-Since`. A 304 or an unchanged content hash carries the page's
  chunks over. Changed pages are re-chunked, and embeddings are reused for any
  chunk hash already embedded with the current model, so editing a paragraph
  re-embeds about one chunk.
- **Outage safe.** 404/410 drops a page. Timeouts, 5xx and 429 keep the previous
  copy (marked stale). If more than half the pages fail transiently, the sync
  doesn't activate and retries with backoff (1m, 5m, 30m).
- **Triggers:** the dashboard (add, re-sync, edit, replace), the per-source sync
  webhook, and the scheduler, which re-crawls URL sources every 6h, 24h or
  weekly.
- **Queue:** `claim_knowledge_job()` uses `FOR UPDATE SKIP LOCKED` with a
  5-minute lease that is renewed every minute. A crashed worker's job is
  re-claimed when its lease expires. Running several workers is safe.

Supported files: PDF (text layer; scanned PDFs are rejected with a clear
message), DOCX, TXT and Markdown, up to 20 MB.

## Develop

```bash
uv sync
uv run ruff check src tests && uv run mypy src
uv run pytest                     # unit tests
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres uv run pytest   # + DB tests
```

The DB tests need Postgres 15+ with pgvector. They create a throwaway database
and apply every migration from `supabase/migrations` on top of small stubs for
Supabase's `auth`/`storage` schemas (`tests/sql/supabase_stubs.sql`).

Run locally with a `.env` (see `.env.example`):

```bash
uv run python -m ingest_worker.main
```

After changing `EMBEDDING_MODEL`, queue re-embedding for every source:

```bash
uv run python -m ingest_worker.reembed
```

## Deploy

Runs on AWS ECS Fargate (ARM64). See `infra/ingest-worker/` for the Terraform
and `.github/workflows/ingest-worker.yml` for CI/CD.
