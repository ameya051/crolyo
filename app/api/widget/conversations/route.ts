import { createAdminClient } from "@/lib/supabase/admin";
import { conversationTopic } from "@/lib/realtime";
import {
  createSessionToken,
  getRequestOrigin,
  hashSessionToken,
  isUuid,
  requireWidgetSite,
  WidgetRequestError,
  widgetError,
  widgetJson,
  widgetPreflight,
} from "@/lib/widget";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  try {
    const body = (await request.json()) as { siteId?: unknown };
    const siteId = typeof body.siteId === "string" ? body.siteId : "";
    if (!isUuid(siteId)) throw new WidgetRequestError(400, "Invalid site id.");

    const { site, origin } = await requireWidgetSite(request, siteId);
    const token = createSessionToken();
    const admin = createAdminClient();
    const { data: conversation, error } = await admin
      .from("conversations")
      .insert({ site_id: site.id, session_token_hash: hashSessionToken(token) })
      .select("id")
      .single();

    if (error || !conversation) {
      logger.error("widget.conversation.create.failed", error, { siteId: site.id, errorCode: error?.code });
      throw new Error("Could not create the conversation");
    }

    return widgetJson(
      {
        conversationId: conversation.id,
        token,
        topic: conversationTopic(conversation.id),
      },
      201,
      origin
    );
  } catch (error) {
    logger.warn("widget.conversation.create.rejected", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return widgetError(error, requestOrigin);
  }
}

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}
