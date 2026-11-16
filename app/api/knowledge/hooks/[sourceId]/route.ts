import { timingSafeEqual } from "crypto";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSessionToken, isUuid } from "@/lib/widget";

export const runtime = "nodejs";

const WEBHOOK_TOKEN_HEADER = "x-crolyo-webhook-token";
const MIN_INTERVAL_MS = 60_000;

function tokensMatch(token: string, expectedHash: string): boolean {
  const received = Buffer.from(hashSessionToken(token), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Sync webhook for a URL knowledge source. Site owners point their CMS
 * publish hook or deploy pipeline here so content changes are re-indexed in
 * seconds instead of waiting for the scheduled re-crawl.
 *
 *   POST /api/knowledge/hooks/{sourceId}?token=...   (or X-Crolyo-Webhook-Token)
 */
export async function POST(request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const token =
    request.headers.get(WEBHOOK_TOKEN_HEADER) ?? new URL(request.url).searchParams.get("token") ?? "";

  if (!isUuid(sourceId) || token.length < 32) {
    return Response.json({ error: "Invalid webhook." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: source, error } = await admin
      .from("knowledge_sources")
      .select("id, type, webhook_token_hash")
      .eq("id", sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!source || source.type !== "url" || !source.webhook_token_hash || !tokensMatch(token, source.webhook_token_hash)) {
      logger.warn("knowledge.webhook.rejected", { sourceId });
      return Response.json({ error: "Invalid webhook." }, { status: 401 });
    }

    // Rate limit: claim the trigger slot atomically (one enqueue per minute).
    const cutoff = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("knowledge_sources")
      .update({ webhook_last_triggered_at: new Date().toISOString() })
      .eq("id", sourceId)
      .or(`webhook_last_triggered_at.is.null,webhook_last_triggered_at.lt.${cutoff}`)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
    }

    const { error: enqueueError } = await admin.rpc("enqueue_knowledge_job", { p_source_id: sourceId });
    if (enqueueError) throw enqueueError;

    logger.info("knowledge.webhook.enqueued", { sourceId });
    return Response.json({ ok: true, queued: true }, { status: 202 });
  } catch (error) {
    logger.error("knowledge.webhook.failed", error, { sourceId });
    return Response.json({ error: "Could not queue the sync." }, { status: 500 });
  }
}
