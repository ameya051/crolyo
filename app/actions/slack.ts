"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { listSlackChannels as fetchSlackChannels, joinConversation } from "@/lib/api/slackApi";
import { logger } from "@/lib/logger";

interface SlackChannelOption {
  id: string;
  name: string;
  is_private: boolean;
}

export async function listSlackChannels(
  siteId: string
): Promise<{ channels?: SlackChannelOption[]; error?: string }> {
  logger.info("slack.channels.list.started", { siteId });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn("slack.channels.list.unauthorized", { siteId });
    return { error: "Unauthorized" };
  }

  const { data: site, error } = await supabase
    .from("sites")
    .select("slack_bot_token")
    .eq("id", siteId)
    .single();

  if (error || !site || !site.slack_bot_token) {
    logger.warn("slack.channels.list.workspace_unavailable", { siteId, errorCode: error?.code });
    return { error: "Site not found or Slack workspace not connected." };
  }

  try {
    const token = decrypt(site.slack_bot_token as string);
    const channels = await fetchSlackChannels(token);
    logger.info("slack.channels.list.succeeded", { siteId, channelCount: channels.length });
    return { channels };
  } catch (err) {
    logger.error("slack.channels.list.failed", err, { siteId });
    return { error: "Could not load Slack channels." };
  }
}

export async function connectSlackChannel(
  siteId: string,
  channelId: string,
  channelName: string
): Promise<{ success?: boolean; error?: string }> {
  logger.info("slack.channel.connect.started", { siteId, channelId });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn("slack.channel.connect.unauthorized", { siteId });
    return { error: "Unauthorized" };
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("slack_bot_token")
    .eq("id", siteId)
    .single();

  if (siteError || !site || !site.slack_bot_token) {
    logger.warn("slack.channel.connect.workspace_unavailable", { siteId, errorCode: siteError?.code });
    return { error: "Slack workspace not connected. Reconnect Slack and try again." };
  }

  let botToken: string;
  try {
    botToken = decrypt(site.slack_bot_token as string);
  } catch (err) {
    logger.error("slack.channel.connect.decrypt_failed", err, { siteId });
    return { error: "Could not read the Slack workspace token. Reconnect Slack and try again." };
  }

  let join: Awaited<ReturnType<typeof joinConversation>>;
  try {
    join = await joinConversation(botToken, channelId);
  } catch (err) {
    logger.error("slack.channel.connect.join_failed", err, { siteId, channelId });
    return { error: `Couldn't join #${channelName} in Slack. Try again, or invite the bot to the channel manually.` };
  }

  if (!join.ok && join.error !== "already_in_channel") {
    logger.warn("slack.channel.connect.join_rejected", { siteId, channelId, errorCode: join.error });
    if (join.error === "method_not_allowed_for_channel_type") {
      return { error: `Couldn't join #${channelName}. Invite the Crolyo bot to that channel, then retry.` };
    }
    return { error: `Couldn't join #${channelName} in Slack (${join.error}). Invite the bot to the channel, then retry.` };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      slack_channel_id: channelId,
      slack_channel_name: channelName,
    })
    .eq("id", siteId);

  if (error) {
    logger.error("slack.channel.connect.failed", error, { siteId, channelId, errorCode: error.code });
    return { error: "Could not save the channel. Please try again." };
  }

  revalidatePath(`/sites/${siteId}`);
  logger.info("slack.channel.connect.succeeded", { siteId, channelId });
  return { success: true };
}
