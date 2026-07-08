alter table public.sites
  add column if not exists slack_workspace_name text,
  add column if not exists slack_channel_name text;
