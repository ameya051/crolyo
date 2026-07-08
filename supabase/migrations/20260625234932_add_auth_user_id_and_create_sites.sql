-- Link public.users to auth.users
alter table public.users
  add column auth_user_id uuid references auth.users(id) on delete cascade;

update public.users u
set auth_user_id = au.id
from auth.users au
where u.email = au.email
  and u.auth_user_id is null;

alter table public.users
  alter column auth_user_id set not null;

create unique index users_auth_user_id_key on public.users(auth_user_id);

-- Update users RLS to use auth.uid()
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select_own"
  on public.users for select
  using (auth_user_id = auth.uid());

create policy "users_update_own"
  on public.users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Create sites table
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slack_workspace_id text,
  slack_bot_token text,
  slack_channel_id text,
  primary_color text not null default '#2eb67d',
  welcome_message text not null default 'Hi! How can we help?',
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sites_user_id_idx on public.sites(user_id);

alter table public.sites enable row level security;

create policy "sites_select_own"
  on public.sites for select
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "sites_insert_own"
  on public.sites for insert
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "sites_update_own"
  on public.sites for update
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  )
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "sites_delete_own"
  on public.sites for delete
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );
