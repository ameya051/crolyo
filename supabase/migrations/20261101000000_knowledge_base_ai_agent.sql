-- Knowledge base + AI agent with Slack escalation.
--
-- Adds:
--   * Postgres enums for every fixed value set (and converts the two existing
--     check-constrained columns on conversations/messages to enums).
--   * AI agent settings on sites, AI/escalation state on conversations.
--   * Knowledge sources, pages, chunks (versioned), ingestion jobs, conflicts.
--   * RPCs for the ingest worker queue, atomic version activation, hybrid
--     (full-text + pgvector) retrieval and conflict detection.
--   * A private Storage bucket for uploaded knowledge files.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.conversation_mode as enum ('ai', 'human');
create type public.conversation_status as enum ('open', 'closed');
create type public.message_sender_type as enum ('visitor', 'agent', 'ai');
create type public.escalation_reason as enum ('visitor_requested', 'high_risk', 'unanswerable', 'agent_error');
create type public.knowledge_source_type as enum ('url', 'file', 'text');
create type public.knowledge_source_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.knowledge_job_kind as enum ('sync', 'reembed');
create type public.knowledge_job_status as enum ('queued', 'running', 'done', 'failed');

-- Convert existing check-constrained text columns to enums.
alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations alter column status drop default;
alter table public.conversations
  alter column status type public.conversation_status using status::public.conversation_status;
alter table public.conversations alter column status set default 'open';

alter table public.messages drop constraint if exists messages_sender_type_check;
alter table public.messages
  alter column sender_type type public.message_sender_type using sender_type::public.message_sender_type;

-- ---------------------------------------------------------------------------
-- Sites, conversations, messages
-- ---------------------------------------------------------------------------

alter table public.sites
  add column ai_agent_enabled boolean not null default false,
  add column ai_agent_instructions text not null default ''
    check (char_length(ai_agent_instructions) <= 2000);

-- Existing conversations stay 'human' so their current Slack routing is unchanged.
alter table public.conversations
  add column mode public.conversation_mode not null default 'human',
  add column escalated_at timestamptz,
  add column escalation_reason public.escalation_reason,
  add column escalation_summary text;

alter table public.messages
  add column metadata jsonb;

-- ---------------------------------------------------------------------------
-- Knowledge sources
-- ---------------------------------------------------------------------------

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  type public.knowledge_source_type not null,
  title text not null check (char_length(title) between 1 and 300),
  -- url sources
  url text,
  crawl boolean not null default false,
  sync_interval_hours integer check (sync_interval_hours is null or sync_interval_hours > 0),
  next_sync_at timestamptz,
  webhook_token_hash text,
  webhook_last_triggered_at timestamptz,
  -- file sources (object in the knowledge-files bucket)
  storage_path text,
  file_name text,
  mime_type text,
  -- set when a file is replaced; the worker deletes it after the new version activates
  replaced_storage_path text,
  -- text sources (source of truth for edits)
  text_content text check (text_content is null or char_length(text_content) <= 50000),
  -- state
  status public.knowledge_source_status not null default 'pending',
  error text,
  active_version integer not null default 0,
  last_synced_at timestamptz,
  page_count integer not null default 0,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_sources_type_fields check (
    (type = 'url' and url is not null)
    or (type = 'file' and storage_path is not null and file_name is not null)
    or (type = 'text' and text_content is not null)
  )
);

create index knowledge_sources_site_id_idx on public.knowledge_sources(site_id);
create index knowledge_sources_next_sync_idx on public.knowledge_sources(next_sync_at)
  where type = 'url' and next_sync_at is not null;

-- One row per fetched page (url) or document (file/text) per version.
create table public.knowledge_pages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  version integer not null,
  url text not null,
  title text,
  etag text,
  last_modified text,
  content_hash text not null,
  -- same-host links found on the page, so a crawl can continue past 304s
  links text[] not null default '{}',
  last_status integer,
  stale_since timestamptz,
  fetched_at timestamptz not null default now(),
  unique (source_id, version, url)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  version integer not null,
  page_url text,
  title text not null default '',
  content text not null,
  chunk_index integer not null,
  content_hash text not null,
  embedding extensions.vector(1024),
  embedding_model text,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', content), 'B')
  ) stored,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_fts_idx on public.knowledge_chunks using gin(fts);
create index knowledge_chunks_source_version_idx on public.knowledge_chunks(source_id, version);
create index knowledge_chunks_site_hash_idx on public.knowledge_chunks(site_id, content_hash);
-- Vector search is an exact scan scoped to one site (at most 3,000 active
-- chunks per site), which is fast and never drops results the way a
-- post-filtered global HNSW index can. Add a partitioned or iterative-scan
-- HNSW index if per-site corpora grow much larger.

create table public.knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  kind public.knowledge_job_kind not null default 'sync',
  status public.knowledge_job_status not null default 'queued',
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  rerun_requested boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

-- At most one live job per source; extra requests coalesce into it.
create unique index knowledge_jobs_one_live_per_source
  on public.knowledge_jobs(source_id) where status in ('queued', 'running');
create index knowledge_jobs_claim_idx on public.knowledge_jobs(status, run_after);

create table public.knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  chunk_id uuid not null references public.knowledge_chunks(id) on delete cascade,
  other_chunk_id uuid not null references public.knowledge_chunks(id) on delete cascade,
  similarity real not null,
  created_at timestamptz not null default now(),
  unique (chunk_id, other_chunk_id)
);

create index knowledge_conflicts_site_idx on public.knowledge_conflicts(site_id);

-- ---------------------------------------------------------------------------
-- RLS: owners can read their own knowledge data. All writes go through
-- server code (ownership checked first) or the ingest worker.
-- ---------------------------------------------------------------------------

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_pages enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_jobs enable row level security;
alter table public.knowledge_conflicts enable row level security;

create policy "knowledge_sources_select_own_site"
  on public.knowledge_sources for select
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "knowledge_pages_select_own_site"
  on public.knowledge_pages for select
  using (
    source_id in (
      select ks.id from public.knowledge_sources ks
      join public.sites s on s.id = ks.site_id
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "knowledge_chunks_select_own_site"
  on public.knowledge_chunks for select
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "knowledge_jobs_select_own_site"
  on public.knowledge_jobs for select
  using (
    source_id in (
      select ks.id from public.knowledge_sources ks
      join public.sites s on s.id = ks.site_id
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "knowledge_conflicts_select_own_site"
  on public.knowledge_conflicts for select
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Queue RPCs
-- ---------------------------------------------------------------------------

-- Enqueue a job for a source, coalescing with any live job:
--   * running -> flag rerun_requested so the worker runs it again afterwards
--   * queued  -> reuse it (run as soon as possible)
--   * none    -> insert and NOTIFY the worker
create or replace function public.enqueue_knowledge_job(
  p_source_id uuid,
  p_kind public.knowledge_job_kind default 'sync'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.knowledge_jobs
     set rerun_requested = true, updated_at = now()
   where source_id = p_source_id and status = 'running'
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;

  update public.knowledge_jobs
     set run_after = least(run_after, now()),
         kind = case when p_kind = 'reembed' then p_kind else kind end,
         updated_at = now()
   where source_id = p_source_id and status = 'queued'
  returning id into v_id;

  if v_id is null then
    insert into public.knowledge_jobs (source_id, kind)
    values (p_source_id, p_kind)
    on conflict (source_id) where status in ('queued', 'running') do nothing
    returning id into v_id;

    if v_id is null then
      -- Lost a race with another enqueue; return the live job.
      select id into v_id
        from public.knowledge_jobs
       where source_id = p_source_id and status in ('queued', 'running');
    end if;
  end if;

  perform pg_notify('knowledge_jobs', v_id::text);
  return v_id;
end;
$$;

-- Claim the next runnable job with a lease. Also recovers jobs whose worker
-- died (expired lease) and fails jobs that have exhausted their attempts.
create or replace function public.claim_knowledge_job(
  p_worker_id text,
  p_lease_seconds integer default 300,
  p_max_attempts integer default 3
)
returns setof public.knowledge_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with exhausted as (
    update public.knowledge_jobs
       set status = 'failed',
           error = coalesce(error, 'The sync stopped responding too many times.'),
           locked_by = null,
           locked_until = null,
           finished_at = now(),
           updated_at = now()
     where status = 'running'
       and locked_until < now()
       and attempts >= p_max_attempts
    returning source_id
  )
  update public.knowledge_sources ks
     set status = 'failed',
         error = 'The sync stopped responding too many times.',
         updated_at = now()
    from exhausted
   where ks.id = exhausted.source_id;

  return query
  with candidate as (
    select id
      from public.knowledge_jobs
     where (status = 'queued' and run_after <= now())
        or (status = 'running' and locked_until < now())
     order by run_after
     for update skip locked
     limit 1
  )
  update public.knowledge_jobs j
     set status = 'running',
         locked_by = p_worker_id,
         locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1,
         updated_at = now()
    from candidate
   where j.id = candidate.id
  returning j.*;
end;
$$;

-- Atomically make `p_version` the live version of a source and drop every
-- other version's pages and chunks.
create or replace function public.activate_source_version(
  p_source_id uuid,
  p_version integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.knowledge_sources
     set active_version = p_version,
         status = 'ready',
         error = null,
         last_synced_at = now(),
         next_sync_at = case
           when type = 'url' and sync_interval_hours is not null
             then now() + make_interval(hours => sync_interval_hours)
           else null
         end,
         page_count = (
           select count(*) from public.knowledge_pages
            where source_id = p_source_id and version = p_version
         ),
         chunk_count = (
           select count(*) from public.knowledge_chunks
            where source_id = p_source_id and version = p_version
         ),
         updated_at = now()
   where id = p_source_id;

  delete from public.knowledge_chunks where source_id = p_source_id and version <> p_version;
  delete from public.knowledge_pages where source_id = p_source_id and version <> p_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retrieval
-- ---------------------------------------------------------------------------

-- Hybrid retrieval over a site's active chunks: full-text (OR semantics) and
-- cosine similarity, fused with reciprocal rank fusion, then deduplicated by
-- content hash (keeping the most recently synced source's copy).
create or replace function public.match_knowledge_chunks(
  p_site_id uuid,
  p_query text,
  p_embedding extensions.vector(1024) default null,
  p_embedding_model text default null,
  p_match_count integer default 8
)
returns table (
  id uuid,
  source_id uuid,
  source_title text,
  source_updated_at timestamptz,
  page_url text,
  title text,
  content text,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with active as (
    select c.id, c.source_id, c.page_url, c.title, c.content, c.content_hash,
           c.fts, c.embedding, c.embedding_model,
           s.title as source_title, s.last_synced_at
      from public.knowledge_chunks c
      join public.knowledge_sources s
        on s.id = c.source_id and c.version = s.active_version
     where c.site_id = p_site_id
  ),
  q as (
    select replace(plainto_tsquery('english', coalesce(p_query, ''))::text, '&', '|') as qtext
  ),
  fts as (
    select a.id,
           row_number() over (order by ts_rank_cd(a.fts, q.qtext::tsquery) desc) as rnk
      from active a, q
     where q.qtext <> '' and a.fts @@ q.qtext::tsquery
     order by rnk
     limit 20
  ),
  vec as (
    select a.id,
           row_number() over (order by a.embedding operator(extensions.<=>) p_embedding) as rnk
      from active a
     where p_embedding is not null
       and a.embedding is not null
       and a.embedding_model = p_embedding_model
     order by rnk
     limit 20
  ),
  fused as (
    select r.id, sum(1.0 / (60 + r.rnk)) as score
      from (select * from fts union all select * from vec) r
     group by r.id
  ),
  deduped as (
    select distinct on (a.content_hash)
           a.id, a.source_id, a.source_title, a.last_synced_at, a.page_url,
           a.title, a.content, f.score
      from fused f
      join active a on a.id = f.id
     order by a.content_hash, a.last_synced_at desc nulls last, f.score desc
  )
  select d.id, d.source_id, d.source_title, d.last_synced_at, d.page_url,
         d.title, d.content, d.score::double precision
    from deduped d
   order by d.score desc
   limit greatest(p_match_count, 1);
$$;

-- Flag chunks of a source's active version that are near-duplicates of a
-- different source's active chunk with different content (possible stale or
-- contradictory information). Returns the number of new conflicts.
create or replace function public.detect_knowledge_conflicts(
  p_source_id uuid,
  p_threshold real default 0.92
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.knowledge_conflicts (site_id, chunk_id, other_chunk_id, similarity)
  select c.site_id, c.id, n.id, n.similarity
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id and c.version = s.active_version
    cross join lateral (
      select o.id,
             (1 - (o.embedding operator(extensions.<=>) c.embedding))::real as similarity
        from public.knowledge_chunks o
        join public.knowledge_sources os on os.id = o.source_id and o.version = os.active_version
       where o.site_id = c.site_id
         and o.source_id <> c.source_id
         and o.content_hash <> c.content_hash
         and o.embedding is not null
         and o.embedding_model = c.embedding_model
       order by o.embedding operator(extensions.<=>) c.embedding
       limit 1
    ) n
   where c.source_id = p_source_id
     and c.embedding is not null
     and n.similarity >= p_threshold
  on conflict (chunk_id, other_chunk_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- These run with the service role only (Next.js admin client / worker).
revoke execute on function public.enqueue_knowledge_job(uuid, public.knowledge_job_kind) from public, anon, authenticated;
revoke execute on function public.claim_knowledge_job(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.activate_source_version(uuid, integer) from public, anon, authenticated;
revoke execute on function public.match_knowledge_chunks(uuid, text, extensions.vector, text, integer) from public, anon, authenticated;
revoke execute on function public.detect_knowledge_conflicts(uuid, real) from public, anon, authenticated;
grant execute on function public.enqueue_knowledge_job(uuid, public.knowledge_job_kind) to service_role;
grant execute on function public.claim_knowledge_job(text, integer, integer) to service_role;
grant execute on function public.activate_source_version(uuid, integer) to service_role;
grant execute on function public.match_knowledge_chunks(uuid, text, extensions.vector, text, integer) to service_role;
grant execute on function public.detect_knowledge_conflicts(uuid, real) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded knowledge files. No anon/authenticated
-- policies: uploads use signed URLs minted server-side after an ownership
-- check, and reads happen with the service key.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-files',
  'knowledge-files',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;
