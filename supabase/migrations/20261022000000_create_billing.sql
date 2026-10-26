-- Billing: app-managed 14-day trial plus Dodo Payments customers and subscriptions.
-- Every Dodo record is tagged with the mode it was created in so test data never
-- grants access when the app runs against live mode.

create type public.billing_mode as enum ('test', 'live');

-- The trial and the Dodo customer are 1:1 with a user, so they live on public.users.
-- The column default starts the trial for new users and backfills existing ones.
-- billing_mode is the mode dodo_customer_id belongs to; a mismatch with the app's
-- mode means a new customer is created on the next checkout.
alter table public.users
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column billing_mode public.billing_mode,
  add column dodo_customer_id text unique,
  add constraint users_dodo_customer_mode_check
    check ((billing_mode is null) = (dodo_customer_id is null));

-- users_update_own lets owners update their row; limit that to name so they
-- can never extend their own trial or swap their customer id.
revoke update on public.users from authenticated;
grant update (name) on public.users to authenticated;

create table public.billing_subscriptions (
  dodo_subscription_id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  mode public.billing_mode not null,
  dodo_customer_id text not null,
  product_id text not null,
  -- Dodo status kept as text so a new status value never breaks writes.
  status text not null,
  next_billing_date timestamptz,
  cancel_at_next_billing_date boolean not null default false,
  cancelled_at timestamptz,
  past_due_ends_at timestamptz,
  last_event_type text not null,
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_subscriptions_user_mode_idx on public.billing_subscriptions(user_id, mode);

-- Owners can read their subscriptions; only the service role writes.
alter table public.billing_subscriptions enable row level security;

create policy "billing_subscriptions_select_own" on public.billing_subscriptions
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = (select auth.uid())));

-- New public tables are not exposed to the Data API without explicit grants.
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select, insert, update, delete on public.billing_subscriptions to service_role;

-- Ordered upsert of a Dodo subscription snapshot. Returns false when the stored
-- row already reflects a newer event (or belongs to another user/mode).
create or replace function public.apply_dodo_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_mode public.billing_mode,
  p_customer_id text,
  p_product_id text,
  p_status text,
  p_next_billing_date timestamptz,
  p_cancel_at_next_billing_date boolean,
  p_cancelled_at timestamptz,
  p_past_due_ends_at timestamptz,
  p_event_type text,
  p_event_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.billing_subscriptions as s (
    dodo_subscription_id, user_id, mode, dodo_customer_id, product_id, status,
    next_billing_date, cancel_at_next_billing_date, cancelled_at, past_due_ends_at,
    last_event_type, last_event_at
  )
  values (
    p_subscription_id, p_user_id, p_mode, p_customer_id, p_product_id, p_status,
    p_next_billing_date, coalesce(p_cancel_at_next_billing_date, false), p_cancelled_at, p_past_due_ends_at,
    p_event_type, p_event_at
  )
  on conflict (dodo_subscription_id) do update set
    dodo_customer_id = excluded.dodo_customer_id,
    product_id = excluded.product_id,
    status = excluded.status,
    next_billing_date = excluded.next_billing_date,
    cancel_at_next_billing_date = excluded.cancel_at_next_billing_date,
    cancelled_at = excluded.cancelled_at,
    past_due_ends_at = excluded.past_due_ends_at,
    last_event_type = excluded.last_event_type,
    last_event_at = excluded.last_event_at,
    updated_at = now()
  where s.last_event_at <= excluded.last_event_at
    and s.user_id = excluded.user_id
    and s.mode = excluded.mode;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.apply_dodo_subscription(
  text, uuid, public.billing_mode, text, text, text, timestamptz, boolean, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_dodo_subscription(
  text, uuid, public.billing_mode, text, text, text, timestamptz, boolean, timestamptz, timestamptz, text, timestamptz
) to service_role;

notify pgrst, 'reload schema';
