import { after } from "next/server";

import { runAgentTurn } from "@/lib/agent/run-turn";
import { postSlackMessage } from "@/lib/api/slackApi";
import { decrypt } from "@/lib/encryption";
import { claimSlackThread, ensureSlackThread } from "@/lib/escalation";
import { logger } from "@/lib/logger";
import { broadcastConversationMessage } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WidgetConversation, WidgetSite } from "@/lib/types";
import {
  getRequestOrigin,
  requireWidgetSession,
  toWidgetMessage,
  WIDGET_MESSAGE_COLUMNS,
  WidgetRequestError,
  widgetError,
  widgetJson,
  widgetPreflight,
} from "@/lib/widget";

export const runtime = "nodejs";
// AI turns run in after(); give them room for retrieval + the model call.
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_MINUTE = 10;

export async function GET(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  try {
    const { conversation, origin } = await requireWidgetSession(request);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("messages")
      .select(WIDGET_MESSAGE_COLUMNS)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return widgetJson({ messages: (data ?? []).map(toWidgetMessage) }, 200, origin);
  } catch (error) {
    logger.warn("widget.messages.list.rejected", { reason: error instanceof Error ? error.message : "unknown" });
    return widgetError(error, requestOrigin);
  }
}

/** Human mode: relay the visitor's message into the conversation's Slack thread. */
async function relayToSlack(conversation: WidgetConversation, site: WidgetSite, content: string): Promise<string> {
  const token = decrypt(site.slack_bot_token!);
  const channel = site.slack_channel_id!;

  if (!conversation.slack_thread_ts) {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id);
    if (error) throw error;

    if ((count ?? 0) === 0) {
      // First message of a human-mode chat: it becomes the thread root.
      const { threadTs, created } = await claimSlackThread(
        conversation.id,
        site,
        `New visitor chat from ${site.name}\n\n${content}`
      );
      if (created) return threadTs;
      const reply = await postSlackMessage(token, { channel, text: content, threadTs });
      return reply.ts!;
    }

    // Earlier messages exist (an AI conversation that was handed off, or a
    // handoff whose Slack post failed): open the thread with the transcript.
    await ensureSlackThread(conversation, site);
    const { data: refreshed, error: refreshError } = await admin
      .from("conversations")
      .select("slack_thread_ts")
      .eq("id", conversation.id)
      .single();
    if (refreshError || !refreshed?.slack_thread_ts) throw refreshError ?? new Error("Thread was not created");
    conversation = { ...conversation, slack_thread_ts: refreshed.slack_thread_ts as string };
  }

  const reply = await postSlackMessage(token, { channel, text: content, threadTs: conversation.slack_thread_ts! });
  return reply.ts!;
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

    // The AI handles the conversation until it escalates; if the owner turns
    // the agent off mid-conversation, the next message goes to Slack.
    const useAgent = conversation.mode === "ai" && site.ai_agent_enabled;
    if (conversation.mode === "ai" && !site.ai_agent_enabled) {
      const { error: modeError } = await admin
        .from("conversations")
        .update({ mode: "human", updated_at: new Date().toISOString() })
        .eq("id", conversation.id);
      if (modeError) throw modeError;
    }

    const slackTs = useAgent ? null : await relayToSlack(conversation, site, content);

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "visitor",
        content,
        slack_ts: slackTs,
      })
      .select(WIDGET_MESSAGE_COLUMNS)
      .single();
    if (insertError || !message) throw insertError ?? new Error("Could not save the message");

    const widgetMessage = toWidgetMessage(message);
    try {
      await broadcastConversationMessage(conversation.id, widgetMessage);
    } catch (broadcastError) {
      logger.error("widget.messages.broadcast_failed", broadcastError, { conversationId: conversation.id });
    }

    if (useAgent) {
      after(() => runAgentTurn({ conversationId: conversation.id, visitorMessageId: message.id, site }));
    }

    return widgetJson({ message: widgetMessage, awaitingReply: useAgent }, 201, origin);
  } catch (error) {
    logger.error("widget.messages.send.failed", error);
    return widgetError(error, requestOrigin);
  }
}

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}
