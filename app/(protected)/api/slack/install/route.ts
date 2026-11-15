import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getSiteUrl, getSlackRedirectUri } from "@/lib/site-url";

// Kept in code (not env) so the scopes always match what the OAuth callback relies on.
// The channel is picked in our dashboard after install (see /api/slack/channels), not on
// Slack's consent screen, so incoming-webhook is deliberately not requested.
// - channels:read / groups:read: conversations.list for the picker, conversations.info membership check.
// - channels:join: lets the bot join the picked public channel.
// - channels:history / groups:history: thread-reply events from the channel.
const SLACK_SCOPES = [
  "chat:write",
  "channels:read",
  "groups:read",
  "channels:history",
  "groups:history",
  "channels:join",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("site_id");
  const origin = getSiteUrl();
  logger.info("slack.install.started", { siteId });

  if (!siteId) {
    logger.warn("slack.install.missing_site_id");
    return NextResponse.redirect(`${origin}/overview?error=slack_missing_site`);
  }

  if (!process.env.SLACK_CLIENT_ID) {
    logger.error("slack.install.configuration_missing", undefined, { configuration: "SLACK_CLIENT_ID", siteId });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .single();

  if (!site) {
    logger.warn("slack.install.site_unavailable", { siteId });
    return NextResponse.redirect(`${origin}/overview?error=slack_unauthorized`);
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  cookieStore.set("slack_oauth_state", state, cookieOptions);
  cookieStore.set("slack_oauth_site_id", siteId, cookieOptions);

  const redirectUri = getSlackRedirectUri();
  const authUrl = new URL("https://slack.com/oauth/v2/authorize");
  authUrl.searchParams.set("client_id", process.env.SLACK_CLIENT_ID);
  authUrl.searchParams.set("scope", SLACK_SCOPES.join(","));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  logger.info("slack.install.redirecting_to_provider", { siteId });
  return NextResponse.redirect(authUrl.toString());
}
