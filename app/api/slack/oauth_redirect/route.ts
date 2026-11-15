import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureBotInChannel, exchangeSlackCode } from "@/lib/api/slackApi";
import { encrypt } from "@/lib/encryption";
import { requireUser } from "@/lib/auth/route-guard";
import { logger } from "@/lib/logger";
import {
  getSiteUrl,
  getSlackOAuthBaseUrl,
  getSlackRedirectUri,
  SLACK_OAUTH_REDIRECT_PATH,
} from "@/lib/site-url";

function requestHost(request: Request): string | null {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}

export async function GET(request: Request) {
  const { searchParams, search } = new URL(request.url);

  // In dev Slack redirects to the ngrok tunnel, but the state cookies and Supabase session
  // live on the site URL's host (localhost). Hop back there with the same query string
  // before touching cookies. The target is the configured site URL, never request input.
  const siteUrl = new URL(getSiteUrl());
  const slackHost = new URL(getSlackOAuthBaseUrl()).host;
  if (slackHost !== siteUrl.host && requestHost(request) === slackHost) {
    logger.info("slack.oauth.callback.bouncing_to_site_host");
    return NextResponse.redirect(`${siteUrl.origin}${SLACK_OAUTH_REDIRECT_PATH}${search}`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("slack_oauth_state")?.value;
  const siteId = cookieStore.get("slack_oauth_site_id")?.value;

  const origin = getSiteUrl();
  logger.info("slack.oauth.callback.started", { hasProviderError: Boolean(error), hasSiteId: Boolean(siteId) });

  const clearOptions = { path: "/", maxAge: 0 };
  cookieStore.set("slack_oauth_state", "", clearOptions);
  cookieStore.set("slack_oauth_site_id", "", clearOptions);

  if (error || !code || !state || !savedState || state !== savedState || !siteId) {
    logger.warn("slack.oauth.callback.validation_failed", {
      hasProviderError: Boolean(error),
      hasCode: Boolean(code),
      stateMatches: Boolean(state && savedState && state === savedState),
      hasSiteId: Boolean(siteId),
    });
    return NextResponse.redirect(`${origin}/overview?error=slack_oauth`);
  }

  const auth = await requireUser();
  if (!auth.user) {
    logger.warn("slack.oauth.callback.unauthorized", { siteId });
    return auth.redirect;
  }

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, slack_workspace_id, slack_channel_id")
    .eq("id", siteId)
    .single();

  if (!site) {
    logger.warn("slack.oauth.callback.site_unavailable", { siteId });
    return NextResponse.redirect(`${origin}/overview?error=slack_unauthorized`);
  }

  const redirectUri = getSlackRedirectUri();
  let oauth: Awaited<ReturnType<typeof exchangeSlackCode>>;
  try {
    oauth = await exchangeSlackCode(code, redirectUri);
  } catch (caughtError) {
    logger.error("slack.oauth.callback.exchange_failed", caughtError, { siteId });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  if (!oauth.ok || !oauth.access_token || !oauth.team) {
    logger.warn("slack.oauth.callback.provider_rejected", { siteId, errorCode: oauth.error });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  let encryptedToken: string;
  try {
    encryptedToken = encrypt(oauth.access_token);
  } catch (caughtError) {
    logger.error("slack.oauth.callback.encryption_failed", caughtError, { siteId });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  // Reinstalling into the same workspace keeps the chosen channel. A new workspace (or a first
  // install) clears it so the dashboard asks the admin to pick one.
  const keepChannel = site.slack_workspace_id === oauth.team.id && Boolean(site.slack_channel_id);

  const { error: dbError } = await supabase
    .from("sites")
    .update({
      slack_workspace_id: oauth.team.id,
      slack_workspace_name: oauth.team.name,
      slack_bot_token: encryptedToken,
      ...(keepChannel ? {} : { slack_channel_id: null, slack_channel_name: null }),
    })
    .eq("id", siteId);

  if (dbError) {
    logger.error("slack.oauth.callback.persistence_failed", dbError, { siteId, errorCode: dbError.code });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  if (!keepChannel) {
    logger.info("slack.oauth.callback.succeeded", { siteId, workspaceId: oauth.team.id, channelKept: false });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=choose_channel`);
  }

  const isMember = await ensureBotInChannel(oauth.access_token, site.slack_channel_id!, siteId);
  logger.info("slack.oauth.callback.succeeded", { siteId, workspaceId: oauth.team.id, channelKept: true, isMember });
  const status = isMember ? "installed" : "needs_invite";
  return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=${status}`);
}
