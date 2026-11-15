import { detectHumanRequest } from "@/lib/agent/guards";
import type { HistoryMessage } from "@/lib/agent/prompt";
import { decideReply } from "@/lib/agent/respond";
import { escalateConversation } from "@/lib/escalation";
import { retrieveContext } from "@/lib/knowledge/retrieve";
import { logger } from "@/lib/logger";
import { broadcastConversationEvent, broadcastConversationMessage } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WidgetSite } from "@/lib/types";
import { toWidgetMessage, WIDGET_MESSAGE_COLUMNS } from "@/lib/widget";

const HISTORY_LIMIT = 20;

type StoredMessage = HistoryMessage & { id: string };

/**
 * Runs one AI turn for a visitor message (called from `after()` so the
 * visitor's POST returns immediately). Any failure escalates to the team
 * instead of leaving the visitor waiting.
 */
export async function runAgentTurn(input: {
  conversationId: string;
  visitorMessageId: string;
  site: WidgetSite;
}): Promise<void> {
  const { conversationId, visitorMessageId, site } = input;
  const admin = createAdminClient();

  try {
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("mode")
      .eq("id", conversationId)
      .single();
    if (conversationError) throw conversationError;
    if (conversation.mode !== "ai") return;

    const { data: rows, error: historyError } = await admin
      .from("messages")
      .select("id, sender_type, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (historyError) throw historyError;
    const history = ((rows ?? []) as StoredMessage[]).reverse();

    // Debounce: if the visitor already sent a newer message, that turn will
    // answer with the full context.
    const latestVisitor = [...history].reverse().find((message) => message.sender_type === "visitor");
    if (latestVisitor?.id !== visitorMessageId) {
      logger.info("agent.turn.superseded", { conversationId });
      return;
    }

    if (detectHumanRequest(latestVisitor.content)) {
      await escalateConversation({ conversationId, site, reason: "visitor_requested", metadata: { source: "guard" } });
      return;
    }

    try {
      await broadcastConversationEvent(conversationId, "typing", { at: new Date().toISOString() });
    } catch (broadcastError) {
      logger.warn("agent.turn.typing_broadcast_failed", {
        conversationId,
        reason: broadcastError instanceof Error ? broadcastError.message : "unknown",
      });
    }

    const chunks = await retrieveContext(site.id, latestVisitor.content);
    const decision = await decideReply({ site, history, chunks });
    const metadata = {
      decision: decision.decision,
      risk_level: decision.risk_level,
      used_chunk_ids: decision.used_chunk_ids,
      retrieved_chunk_ids: chunks.map((chunk) => chunk.id),
    };

    if (decision.decision === "escalate" || decision.escalation_reason !== "none" || !decision.reply) {
      const reason = decision.escalation_reason === "none" ? "unanswerable" : decision.escalation_reason;
      await escalateConversation({
        conversationId,
        site,
        reason,
        summary: decision.summary,
        reply: decision.reply,
        metadata,
      });
      return;
    }

    // Don't post an answer if the conversation was handed off meanwhile.
    const { data: stillAi } = await admin
      .from("conversations")
      .select("mode")
      .eq("id", conversationId)
      .single();
    if (stillAi?.mode !== "ai") return;

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({ conversation_id: conversationId, sender_type: "ai", content: decision.reply, metadata })
      .select(WIDGET_MESSAGE_COLUMNS)
      .single();
    if (insertError || !message) throw insertError ?? new Error("Could not save the AI reply");

    try {
      await broadcastConversationMessage(conversationId, toWidgetMessage(message));
    } catch (broadcastError) {
      logger.error("agent.turn.broadcast_failed", broadcastError, { conversationId });
    }
    logger.info("agent.turn.answered", { conversationId, riskLevel: decision.risk_level });
  } catch (error) {
    logger.error("agent.turn.failed", error, { conversationId });
    try {
      await escalateConversation({
        conversationId,
        site,
        reason: "agent_error",
        summary: "The AI assistant hit an error answering this conversation.",
      });
    } catch (escalationError) {
      logger.error("agent.turn.escalation_failed", escalationError, { conversationId });
    }
  }
}
