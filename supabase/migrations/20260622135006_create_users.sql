create table users(
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table users enable row level security;

-- Users can read their own row only
create policy "users_select_own"
    on users
    for select
    using (email = auth.jwt() ->> 'email');

-- Users can update their own row only (cannot change email/id)
create policy "users_update_own"
    on users
    for update
    using (email = auth.jwt() ->> 'email')
    with check (email = auth.jwt() ->> 'email');

-- Insert is restricted to service role only (handled server-side on signup)
-- No insert policy for authenticated users means only service_role can insert

-- Delete is restricted to service role only
-- No delete policy for authenticated users means only service_role can delete
