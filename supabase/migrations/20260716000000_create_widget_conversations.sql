create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  visitor_id uuid not null default gen_random_uuid(),
  session_token_hash text not null unique,
  slack_thread_ts text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slack_thread_ts)
);

create index conversations_site_id_idx on public.conversations(site_id);
create index conversations_site_thread_idx on public.conversations(site_id, slack_thread_ts)
  where slack_thread_ts is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor', 'agent')),
  sender_id text,
  content text not null check (char_length(content) between 1 and 2000),
  slack_ts text,
  slack_event_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_own_site"
  on public.conversations for select
  using (
    site_id in (
      select s.id
      from public.sites s
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "messages_select_own_site"
  on public.messages for select
  using (
    conversation_id in (
      select c.id
      from public.conversations c
      join public.sites s on s.id = c.site_id
      join public.users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );
