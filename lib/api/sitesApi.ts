import { createClient } from "@/lib/supabase/client";
import type { Site } from "@/app/(protected)/_lib/types";
import {
  createSiteSchema,
  deleteSiteSchema,
  normalizeDomain,
  updateSiteSchema,
  type CreateSiteValues,
  type DeleteSiteValues,
  type UpdateSiteValues,
} from "@/lib/validations/site";

type SitePublicRow = {
  id: string;
  user_id: string;
  name: string;
  slack_workspace_id: string | null;
  slack_channel_id: string | null;
  slack_workspace_name: string | null;
  slack_channel_name: string | null;
  primary_color: string;
  welcome_message: string;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
};

const SITE_PUBLIC_SELECT =
  "id, user_id, name, primary_color, welcome_message, allowed_domains, created_at, updated_at, slack_workspace_id, slack_channel_id, slack_workspace_name, slack_channel_name" as const;

export type CreateSiteRequest = CreateSiteValues;
export type UpdateSiteRequest = UpdateSiteValues;
export type DeleteSiteRequest = DeleteSiteValues;

export type SitesResponse = { sites: Site[]; error?: never } | { sites: []; error: string };
export type SiteResponse = { site: Site | null; error?: never } | { site: null; error: string };
export type SiteMutationResponse = { site: Site; error?: never } | { site?: never; error: string };
export type DeleteSiteResponse = { ok: true; error?: never } | { ok?: never; error: string };

function mapSiteRow(row: SitePublicRow): Site {
  const allowedDomains = row.allowed_domains ?? [];
  const slackConnected = Boolean(row.slack_channel_id && row.slack_workspace_id);

  return {
    id: row.id,
    name: row.name,
    domain: allowedDomains[0] ?? "",
    primaryColor: row.primary_color,
    welcomeMessage: row.welcome_message,
    allowedDomains,
    slackStatus: slackConnected ? "connected" : "disconnected",
    slackWorkspaceName: row.slack_workspace_name ?? null,
    slackChannelName: row.slack_channel_name ?? null,
    widgetStatus: "not-installed",
    createdAt: row.created_at,
  };
}

export async function listSites(): Promise<SitesResponse> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sites")
    .select(SITE_PUBLIC_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return { sites: [], error: "Could not load your sites. Please try again." };
  }

  return { sites: (data as SitePublicRow[]).map(mapSiteRow) };
}

export async function getSiteById(id: string): Promise<SiteResponse> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sites")
    .select(SITE_PUBLIC_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { site: null, error: "Could not load this site. Please try again." };
  }

  return { site: data ? mapSiteRow(data as SitePublicRow) : null };
}

export async function createSite(req: CreateSiteRequest): Promise<SiteMutationResponse> {
  const normalized = { ...req, domain: normalizeDomain(req.domain) };
  const validated = createSiteSchema.safeParse(normalized);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Please check the site details and try again." };
  }

  const supabase = createClient();
  const { data: userRecord, error: userError } = await supabase
    .from("users")
    .select("id")
    .maybeSingle();

  if (userError || !userRecord) {
    console.error(userError);
    return { error: "Could not identify your account. Please sign in again." };
  }

  const { data, error } = await supabase
    .from("sites")
    .insert({
      user_id: userRecord.id,
      name: validated.data.name.trim(),
      allowed_domains: [validated.data.domain],
      primary_color: validated.data.primaryColor,
    })
    .select(SITE_PUBLIC_SELECT)
    .single();

  if (error || !data) {
    console.error(error);
    return { error: "Could not create the site. Please try again." };
  }

  return { site: mapSiteRow(data as SitePublicRow) };
}

export async function updateSite(req: UpdateSiteRequest): Promise<SiteMutationResponse> {
  const normalized = {
    ...req,
    domain: normalizeDomain(req.domain),
    allowedDomains: (req.allowedDomains ?? []).map(normalizeDomain).filter(Boolean),
  };
  const validated = updateSiteSchema.safeParse(normalized);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Please check the site details and try again." };
  }

  const { id, name, domain, allowedDomains, primaryColor, welcomeMessage } = validated.data;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      name: name.trim(),
      allowed_domains: Array.from(new Set([domain, ...allowedDomains])),
      primary_color: primaryColor,
      welcome_message: welcomeMessage,
    })
    .eq("id", id)
    .select(SITE_PUBLIC_SELECT)
    .single();

  if (error || !data) {
    console.error(error);
    return { error: "Could not update the site. Please try again." };
  }

  return { site: mapSiteRow(data as SitePublicRow) };
}

export async function deleteSite(req: DeleteSiteRequest): Promise<DeleteSiteResponse> {
  const validated = deleteSiteSchema.safeParse(req);
  if (!validated.success) return { error: validated.error.issues[0]?.message ?? "Invalid site id." };

  const supabase = createClient();
  const { error } = await supabase.from("sites").delete().eq("id", validated.data.id);

  if (error) {
    console.error(error);
    return { error: "Could not delete the site. Please try again." };
  }

  return { ok: true };
}
