import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getBillingMode, getDodoClient } from "@/lib/billing/dodo";
import {
  applySubscriptionSnapshot,
  detectDuplicateSubscriptions,
  resolveSubscriptionOwner,
} from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { dodoSubscriptionSchema } from "@/lib/validations/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let dodo: ReturnType<typeof getDodoClient>;
  try {
    dodo = getDodoClient();
  } catch (error) {
    logger.error("billing.webhook.configuration_missing", error);
    return Response.json({ error: "Billing is not configured." }, { status: 500 });
  }

  let event: ReturnType<typeof dodo.webhooks.unwrap>;
  try {
    // Headers must always be passed: unwrap skips verification without them.
    event = dodo.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      },
    });
  } catch {
    logger.warn("billing.webhook.signature_invalid");
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  if (!event.type.startsWith("subscription.")) {
    logger.info("billing.webhook.ignored", { eventType: event.type });
    return Response.json({ received: true });
  }

  // A malformed payload won't improve on retry, so acknowledge it.
  const parsed = dodoSubscriptionSchema.safeParse(event.data);
  if (!parsed.success) {
    logger.error("billing.webhook.payload_invalid", null, { eventType: event.type });
    return Response.json({ received: true });
  }

  const snapshot = parsed.data;
  const mode = getBillingMode();
  const context = { eventType: event.type, mode, subscriptionId: snapshot.subscription_id, status: snapshot.status };

  try {
    const admin = createAdminClient();
    const userId = await resolveSubscriptionOwner(admin, snapshot, mode);
    if (!userId) {
      logger.warn("billing.webhook.owner_not_found", context);
      return Response.json({ received: true });
    }

    // Order by the event's own timestamp; the webhook-timestamp header changes per retry.
    const applied = await applySubscriptionSnapshot(admin, {
      userId,
      mode,
      snapshot,
      eventType: event.type,
      eventAt: event.timestamp,
    });
    if (!applied) {
      logger.info("billing.webhook.subscription_stale", context);
      return Response.json({ received: true });
    }

    logger.info("billing.webhook.subscription_applied", context);
    if (subscriptionGrantsAccess(snapshot)) {
      await detectDuplicateSubscriptions(admin, userId, mode);
    }
    return Response.json({ received: true });
  } catch (error) {
    // The user was deleted between lookup and write; nothing left to update.
    if ((error as { code?: string } | null)?.code === "23503") {
      logger.warn("billing.webhook.owner_deleted", context);
      return Response.json({ received: true });
    }
    logger.error("billing.webhook.processing_failed", error, context);
    return Response.json({ error: "Could not process webhook." }, { status: 500 });
  }
}
