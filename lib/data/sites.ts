import { createClient } from "@/lib/supabase/server";
import type { Site } from "@/app/(protected)/_lib/types";

export interface SiteRow {
  id: string;
  user_id: string;
  name: string;
  slack_workspace_id: string | null;
  slack_bot_token: string | null;
  slack_channel_id: string | null;
  slack_workspace_name: string | null;
  slack_channel_name: string | null;
  primary_color: string;
  welcome_message: string;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
}

export function mapSiteRow(row: SiteRow): Site {
  const allowedDomains = row.allowed_domains ?? [];
  return {
    id: row.id,
    name: row.name,
    domain: allowedDomains[0] ?? "",
    primaryColor: row.primary_color,
    welcomeMessage: row.welcome_message,
    allowedDomains,
    slackStatus: row.slack_bot_token && row.slack_channel_id ? "connected" : "disconnected",
    slackWorkspaceName: row.slack_workspace_name ?? null,
    slackChannelName: row.slack_channel_name ?? null,
    widgetStatus: "not-installed",
    createdAt: row.created_at,
  };
}

export async function getSitesForUser(): Promise<Site[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error(error);
    return [];
  }

  return (data as SiteRow[]).map(mapSiteRow);
}

export async function getSiteById(id: string): Promise<Site | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapSiteRow(data as SiteRow);
}
