import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { uninstallSlackApp } from "@/lib/api/slackApi";
import { requireUser } from "@/lib/auth/route-guard";
import { logger } from "@/lib/logger";

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("site_id");

  if (!siteId) {
    return NextResponse.json({ error: "Missing site_id parameter." }, { status: 400 });
  }

  const auth = await requireUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: site, error: fetchError } = await supabase
    .from("sites")
    .select("id, slack_bot_token")
    .eq("id", siteId)
    .single();

  if (fetchError || !site) {
    logger.warn("slack.disconnect.site_unavailable", { siteId, errorCode: fetchError?.code });
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  let token: string | null = null;
  if (site.slack_bot_token) {
    try {
      token = decrypt(site.slack_bot_token as string);
    } catch {
      logger.warn("slack.disconnect.token_decrypt_failed", { siteId });
    }
  }

  if (token) {
    try {
      const result = await uninstallSlackApp(token);
      if (!result.ok) {
        if (result.error === "not_authed" || result.error === "invalid_auth") {
          logger.info("slack.disconnect.token_already_invalid", { siteId, slackError: result.error });
        } else {
          logger.warn("slack.disconnect.uninstall_rejected", { siteId, slackError: result.error });
          return NextResponse.json(
            { error: "Failed to uninstall the Slack app. Try again." },
            { status: 502 }
          );
        }
      }
    } catch {
      logger.error("slack.disconnect.uninstall_failed", undefined, { siteId });
      return NextResponse.json(
        { error: "Failed to uninstall the Slack app. Try again." },
        { status: 502 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("sites")
    .update({
      slack_workspace_id: null,
      slack_workspace_name: null,
      slack_bot_token: null,
      slack_channel_id: null,
      slack_channel_name: null,
    })
    .eq("id", siteId);

  if (updateError) {
    logger.error("slack.disconnect.db_update_failed", updateError, { siteId, errorCode: updateError.code });
    return NextResponse.json({ error: "Could not disconnect Slack. Please try again." }, { status: 500 });
  }

  logger.info("slack.disconnect.succeeded", { siteId });
  return NextResponse.json({ success: true });
}
