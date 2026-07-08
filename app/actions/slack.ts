"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { listSlackChannels as fetchSlackChannels } from "@/lib/slack/api";

interface SlackChannelOption {
  id: string;
  name: string;
  is_private: boolean;
}

export async function listSlackChannels(
  siteId: string
): Promise<{ channels?: SlackChannelOption[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: site, error } = await supabase
    .from("sites")
    .select("slack_bot_token")
    .eq("id", siteId)
    .single();

  if (error || !site || !site.slack_bot_token) {
    return { error: "Site not found or Slack workspace not connected." };
  }

  try {
    const token = decrypt(site.slack_bot_token as string);
    const channels = await fetchSlackChannels(token);
    return { channels };
  } catch (err) {
    console.error(err);
    return { error: "Could not load Slack channels." };
  }
}

export async function connectSlackChannel(
  siteId: string,
  channelId: string,
  channelName: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    console.error(error);
    return { error: "Could not save the channel. Please try again." };
  }

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}
