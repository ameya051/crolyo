import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { ensureBotInChannel, listConversations } from "@/lib/api/slackApi";
import { requireUser } from "@/lib/auth/route-guard";
import { logger } from "@/lib/logger";

/** Loads the site (RLS limits it to the signed-in owner) and decrypts its bot token. */
async function loadSiteToken(siteId: string) {
  const supabase = await createClient();
  const { data: site, error } = await supabase
    .from("sites")
    .select("id, slack_bot_token")
    .eq("id", siteId)
    .single();

  if (error || !site) return { supabase, error: "Site not found.", status: 404 } as const;
  if (!site.slack_bot_token) return { supabase, error: "Slack is not connected for this site.", status: 409 } as const;

  try {
    return { supabase, token: decrypt(site.slack_bot_token as string) } as const;
  } catch {
    logger.warn("slack.channels.token_decrypt_failed", { siteId });
    return { supabase, error: "Reconnect Slack and try again.", status: 409 } as const;
  }
}

export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("site_id");
  if (!siteId) return NextResponse.json({ error: "Missing site_id parameter." }, { status: 400 });

  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const loaded = await loadSiteToken(siteId);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  try {
    const result = await listConversations(loaded.token);
    if (!result.ok) {
      logger.warn("slack.channels.list_rejected", { siteId, errorCode: result.error });
      return NextResponse.json({ error: "Slack wouldn't list channels. Try reconnecting Slack." }, { status: 502 });
    }
    return NextResponse.json({ channels: result.channels });
  } catch {
    return NextResponse.json({ error: "Could not reach Slack. Please try again." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const siteId = new URL(request.url).searchParams.get("site_id");
  if (!siteId) return NextResponse.json({ error: "Missing site_id parameter." }, { status: 400 });

  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { channelId?: unknown } | null;
  const channelId = typeof body?.channelId === "string" ? body.channelId : "";
  if (!/^[CG][A-Z0-9]+$/.test(channelId)) {
    return NextResponse.json({ error: "Pick a channel." }, { status: 400 });
  }

  const loaded = await loadSiteToken(siteId);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  // Resolve the name from Slack rather than trusting the client, which also proves the
  // channel belongs to this workspace and is visible to the bot.
  let channel: { id: string; name: string } | undefined;
  try {
    const result = await listConversations(loaded.token);
    if (result.ok) channel = result.channels.find((c) => c.id === channelId);
  } catch {
    return NextResponse.json({ error: "Could not reach Slack. Please try again." }, { status: 502 });
  }
  if (!channel) {
    logger.warn("slack.channels.select_unknown_channel", { siteId, channelId });
    return NextResponse.json({ error: "That channel isn't available. Refresh the list and try again." }, { status: 400 });
  }

  const { error: updateError } = await loaded.supabase
    .from("sites")
    .update({ slack_channel_id: channel.id, slack_channel_name: channel.name })
    .eq("id", siteId);

  if (updateError) {
    logger.error("slack.channels.select_persist_failed", updateError, { siteId, errorCode: updateError.code });
    return NextResponse.json({ error: "Could not save the channel. Please try again." }, { status: 500 });
  }

  const isMember = await ensureBotInChannel(loaded.token, channel.id, siteId);
  logger.info("slack.channels.select_succeeded", { siteId, channelId: channel.id, isMember });
  return NextResponse.json({ status: isMember ? "installed" : "needs_invite" });
}
