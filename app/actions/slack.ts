"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { listSlackChannels as fetchSlackChannels } from "@/lib/slack/api";
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
