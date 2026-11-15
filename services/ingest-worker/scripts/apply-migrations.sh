#!/usr/bin/env bash
# Apply the Supabase stubs and every repo migration to $DATABASE_URL, in order.
# Used by the worker's DB tests (locally and in CI) against plain Postgres + pgvector.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL must be set}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$here/../tests/sql/supabase_stubs.sql"
for f in "$repo"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
