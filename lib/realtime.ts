import type { WidgetMessage } from "@/lib/types";

export function conversationTopic(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/** Sends an ephemeral notification; messages remain durable in Postgres. */
export async function broadcastConversationMessage(
  conversationId: string,
  message: WidgetMessage
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Realtime credentials are not configured");
  }

  const topic = encodeURIComponent(conversationTopic(conversationId));
  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast/${topic}/events/message`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Realtime broadcast failed with status ${response.status}`);
  }
}
