import { deleteSlackMessage, postSlackMessage } from "@/lib/api/slackApi";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { broadcastConversationMessage } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EscalationReason, MessageSenderType, WidgetConversation, WidgetSite } from "@/lib/types";
import { toWidgetMessage, WIDGET_CONVERSATION_COLUMNS, WIDGET_MESSAGE_COLUMNS } from "@/lib/widget";

const TRANSCRIPT_MESSAGE_LIMIT = 30;
const SLACK_TEXT_LIMIT = 35_000;

export const ESCALATION_REASON_LABELS: Record<EscalationReason, string> = {
  visitor_requested: "Visitor asked for a human",
  high_risk: "High-risk query",
  unanswerable: "Question not covered by the knowledge base",
  agent_error: "AI assistant couldn't respond",
};

const SENDER_LABELS: Record<MessageSenderType, string> = {
  visitor: "Visitor",
  ai: "AI",
  agent: "Agent",
};

export const HANDOFF_MESSAGE = "I've passed this to the team. Someone will reply here shortly.";
export const HANDOFF_FAILED_MESSAGE =
  "I'm having trouble reaching the team right now. Please send another message in a moment and I'll try again.";

type TranscriptMessage = { sender_type: MessageSenderType; content: string };

export function formatTranscript(messages: TranscriptMessage[], budget = SLACK_TEXT_LIMIT): string {
  const recent = messages.slice(-TRANSCRIPT_MESSAGE_LIMIT);
  const lines = recent.map((message) => `${SENDER_LABELS[message.sender_type]}: ${message.content}`);
  const omitted = messages.length - recent.length;

  // Keep the newest lines when over budget; they matter most to the responder.
  const kept: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (used + line.length + 1 > budget) break;
    kept.unshift(line);
    used += line.length + 1;
  }
  const dropped = omitted + (lines.length - kept.length);
  return [dropped > 0 ? `(${dropped} earlier message${dropped === 1 ? "" : "s"} not shown)` : null, ...kept]
    .filter(Boolean)
    .join("\n");
}

export function buildThreadRootText(
  site: Pick<WidgetSite, "name">,
  conversation: Pick<WidgetConversation, "escalation_reason" | "escalation_summary">,
  history: TranscriptMessage[]
): string {
  const header = conversation.escalation_reason
    ? `Escalated chat from ${site.name}: ${ESCALATION_REASON_LABELS[conversation.escalation_reason]}`
    : `Chat from ${site.name}`;
  const summary = conversation.escalation_summary?.trim();
  const footer = "Reply in this thread to respond to the visitor.";
  const fixed = [header, summary ? `Summary: ${summary}` : null, "Transcript:", footer]
    .filter(Boolean)
    .join("\n").length;
  const transcript = formatTranscript(history, SLACK_TEXT_LIMIT - fixed - 10);
  return [header, summary ? `Summary: ${summary}` : null, "", "Transcript:", transcript, "", footer]
    .filter((line) => line !== null)
    .join("\n");
}

async function loadHistory(conversationId: string): Promise<TranscriptMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TranscriptMessage[];
}

function slackCredentials(site: WidgetSite): { token: string; channel: string } {
  if (!site.slack_bot_token || !site.slack_channel_id) {
    throw new Error("Slack is not connected for this site");
  }
  return { token: decrypt(site.slack_bot_token), channel: site.slack_channel_id };
}

/**
 * Posts `rootText` as a new Slack thread root and records it on the
 * conversation, unless another request already created the thread. If we lose
 * that race, our root is deleted and the existing thread is used.
 */
export async function claimSlackThread(
  conversationId: string,
  site: WidgetSite,
  rootText: string
): Promise<{ threadTs: string; created: boolean }> {
  const { token, channel } = slackCredentials(site);
  const root = await postSlackMessage(token, { channel, text: rootText });
  const rootTs = root.ts!;

  const admin = createAdminClient();
  const { data: claimed, error } = await admin
    .from("conversations")
    .update({ slack_thread_ts: rootTs, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .is("slack_thread_ts", null)
    .select("slack_thread_ts")
    .maybeSingle();
  if (error) throw error;
  if (claimed) return { threadTs: rootTs, created: true };

  const { data: current, error: currentError } = await admin
    .from("conversations")
    .select("slack_thread_ts")
    .eq("id", conversationId)
    .single();
  if (currentError || !current?.slack_thread_ts) {
    throw currentError ?? new Error("Conversation thread could not be resolved");
  }
  logger.warn("escalation.thread.race_lost", { conversationId });
  await deleteSlackMessage(token, { channel, ts: rootTs });
  return { threadTs: current.slack_thread_ts as string, created: false };
}

/**
 * Makes sure a conversation with earlier messages has a Slack thread, posting
 * the transcript so far (and the escalation reason/summary) as its root.
 */
export async function ensureSlackThread(conversation: WidgetConversation, site: WidgetSite): Promise<string> {
  if (conversation.slack_thread_ts) return conversation.slack_thread_ts;
  const history = await loadHistory(conversation.id);
  const { threadTs } = await claimSlackThread(conversation.id, site, buildThreadRootText(site, conversation, history));
  return threadTs;
}

async function insertAiMessage(conversationId: string, content: string, metadata: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_type: "ai", content, metadata })
    .select(WIDGET_MESSAGE_COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("Could not save the handoff message");
  try {
    await broadcastConversationMessage(conversationId, toWidgetMessage(data));
  } catch (broadcastError) {
    logger.error("escalation.broadcast_failed", broadcastError, { conversationId });
  }
}

/**
 * Hands an AI-mode conversation to the team. Idempotent: only the first call
 * flips the mode, so concurrent turns can't open two Slack threads.
 */
export async function escalateConversation(input: {
  conversationId: string;
  site: WidgetSite;
  reason: EscalationReason;
  summary?: string;
  reply?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ escalated: boolean }> {
  const admin = createAdminClient();
  const { data: conversation, error } = await admin
    .from("conversations")
    .update({
      mode: "human",
      escalated_at: new Date().toISOString(),
      escalation_reason: input.reason,
      escalation_summary: input.summary?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId)
    .eq("mode", "ai")
    .select(WIDGET_CONVERSATION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!conversation) {
    logger.info("escalation.skipped.already_human", { conversationId: input.conversationId });
    return { escalated: false };
  }

  logger.info("escalation.started", { conversationId: input.conversationId, reason: input.reason });
  try {
    await ensureSlackThread(conversation as WidgetConversation, input.site);
  } catch (slackError) {
    // Mode stays 'human' without a thread: the next visitor message retries
    // ensureSlackThread, so the transcript still reaches the team.
    logger.error("escalation.slack_failed", slackError, { conversationId: input.conversationId });
    await insertAiMessage(input.conversationId, HANDOFF_FAILED_MESSAGE, {
      kind: "handoff_failed",
      reason: input.reason,
    });
    return { escalated: true };
  }

  await insertAiMessage(input.conversationId, input.reply?.trim() || HANDOFF_MESSAGE, {
    kind: "handoff",
    reason: input.reason,
    ...input.metadata,
  });
  logger.info("escalation.completed", { conversationId: input.conversationId, reason: input.reason });
  return { escalated: true };
}
