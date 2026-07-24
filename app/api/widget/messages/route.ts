import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { broadcastConversationMessage } from "@/lib/realtime";
import { postSlackMessage } from "@/lib/api/slackApi";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRequestOrigin,
  requireWidgetSession,
  toWidgetMessage,
  WidgetRequestError,
  widgetError,
  widgetJson,
  widgetPreflight,
} from "@/lib/widget";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_MINUTE = 10;

export async function GET(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  try {
    const { conversation, origin } = await requireWidgetSession(request);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("messages")
      .select("id, sender_type, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return widgetJson({ messages: (data ?? []).map(toWidgetMessage) }, 200, origin);
  } catch (error) {
    logger.warn("widget.messages.list.rejected", { reason: error instanceof Error ? error.message : "unknown" });
    return widgetError(error, requestOrigin);
  }
}

export async function POST(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  try {
    const { conversation, site, origin } = await requireWidgetSession(request);
    const body = (await request.json()) as { content?: unknown };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      throw new WidgetRequestError(400, `Messages must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
    }

    if (!site.slack_bot_token || !site.slack_channel_id) {
      throw new WidgetRequestError(409, "Slack is not connected for this site.");
    }

    const admin = createAdminClient();
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "visitor")
      .gte("created_at", oneMinuteAgo);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
      throw new WidgetRequestError(429, "Please wait a moment before sending another message.");
    }

    const slackToken = decrypt(site.slack_bot_token);
    const slackMessage = await postSlackMessage(slackToken, {
      channel: site.slack_channel_id,
      text: conversation.slack_thread_ts
        ? content
        : `New visitor chat from ${site.name}\n\n${content}`,
      threadTs: conversation.slack_thread_ts ?? undefined,
    });

    let threadTs = conversation.slack_thread_ts;
    if (!threadTs) {
      threadTs = slackMessage.ts!;
      const { error: updateError } = await admin
        .from("conversations")
        .update({ slack_thread_ts: threadTs, updated_at: new Date().toISOString() })
        .eq("id", conversation.id);
      if (updateError) throw updateError;
    }

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "visitor",
        content,
        slack_ts: slackMessage.ts,
      })
      .select("id, sender_type, content, created_at")
      .single();
    if (insertError || !message) throw insertError ?? new Error("Could not save the message");

    const widgetMessage = toWidgetMessage(message);
    try {
      await broadcastConversationMessage(conversation.id, widgetMessage);
    } catch (broadcastError) {
      logger.error("widget.messages.broadcast_failed", broadcastError, { conversationId: conversation.id });
    }

    return widgetJson({ message: widgetMessage }, 201, origin);
  } catch (error) {
    logger.error("widget.messages.send.failed", error);
    return widgetError(error, requestOrigin);
  }
}

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}
