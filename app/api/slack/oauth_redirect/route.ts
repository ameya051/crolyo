import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/slack/api";
import { encrypt } from "@/lib/encryption";
import { requireUser } from "@/lib/auth/route-guard";
import { logger } from "@/lib/logger";

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
    .select("id")
    .eq("id", siteId)
    .single();

  if (!site) {
    logger.warn("slack.oauth.callback.site_unavailable", { siteId });
    return NextResponse.redirect(`${origin}/overview?error=slack_unauthorized`);
  }

  const redirectUri = `${origin}/api/slack/oauth_redirect`;
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

  const { error: dbError } = await supabase
    .from("sites")
    .update({
      slack_workspace_id: oauth.team.id,
      slack_workspace_name: oauth.team.name,
      slack_bot_token: encryptedToken,
    })
    .eq("id", siteId);

  if (dbError) {
    logger.error("slack.oauth.callback.persistence_failed", dbError, { siteId, errorCode: dbError.code });
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  logger.info("slack.oauth.callback.succeeded", { siteId, workspaceId: oauth.team.id });
  return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=installed`);
}
