import { createHmac, timingSafeEqual } from "crypto";

import { logger } from "@/lib/logger";
import { broadcastConversationMessage } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { toWidgetMessage } from "@/lib/widget";

export const runtime = "nodejs";

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  team_id?: string;
  event_id?: string;
  event?: {
    type?: string;
    subtype?: string;
    bot_id?: string;
    channel?: string;
    thread_ts?: string;
    user?: string;
    text?: string;
    ts?: string;
  };
};

function validSlackSignature(request: Request, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!signingSecret || !timestamp || !signature) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return false;
  }

  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSlackSignature(request, rawBody)) {
    logger.warn("slack.events.signature_invalid");
    return Response.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  let payload: SlackEventEnvelope;
  try {
    payload = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge ?? "" });
  }

  const event = payload.event;
  if (
    payload.type !== "event_callback" ||
    event?.type !== "message" ||
    Boolean(event.subtype) ||
    Boolean(event.bot_id) ||
    !payload.team_id ||
    !payload.event_id ||
    !event.channel ||
    !event.thread_ts ||
    !event.user ||
    !event.text ||
    !event.ts
  ) {
    return Response.json({ ok: true });
  }

  try {
    const admin = createAdminClient();
    const { data: site, error: siteError } = await admin
      .from("sites")
      .select("id")
      .eq("slack_workspace_id", payload.team_id)
      .eq("slack_channel_id", event.channel)
      .maybeSingle();
    if (siteError) throw siteError;
    if (!site) return Response.json({ ok: true });

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("id")
      .eq("site_id", site.id)
      .eq("slack_thread_ts", event.thread_ts)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return Response.json({ ok: true });

    const { data: message, error: messageError } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "agent",
        sender_id: event.user,
        content: event.text,
        slack_ts: event.ts,
        slack_event_id: payload.event_id,
      })
      .select("id, sender_type, content, created_at")
      .single();

    if (messageError?.code === "23505") {
      return Response.json({ ok: true });
    }
    if (messageError || !message) throw messageError ?? new Error("Could not save Slack reply");

    try {
      await broadcastConversationMessage(conversation.id, toWidgetMessage(message));
    } catch (broadcastError) {
      logger.error("slack.events.broadcast_failed", broadcastError, { conversationId: conversation.id });
    }

    return Response.json({ ok: true });
  } catch (error) {
    logger.error("slack.events.processing_failed", error);
    return Response.json({ error: "Could not process Slack event." }, { status: 500 });
  }
}
