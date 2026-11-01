import type { User } from "@supabase/supabase-js";

import { findBlockingSubscription, remainingTrialDays } from "@/lib/billing/access";
import { getDodoClient, getProductId } from "@/lib/billing/dodo";
import { ensureDodoCustomer } from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingAccountRow, BillingCheckoutSessionRow, BillingInterval, BillingMode } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Dodo expires checkout sessions after 24h; stop handing out the URL an hour before. */
const SESSION_TTL_MS = 23 * 60 * 60 * 1000;
/** A reservation still pending after this long belongs to a request that died. */
const PENDING_TIMEOUT_MS = 60 * 1000;
const LIVE_STATUSES = ["pending", "open"] as const;
const SESSION_SELECT = "id, user_id, mode, interval, status, dodo_session_id, checkout_url, expires_at, created_at";

export type CheckoutResult =
  | { kind: "ready"; checkoutUrl: string; resumed: boolean }
  | { kind: "subscription_exists" | "payment_failed" }
  | { kind: "checkout_open"; interval: BillingInterval; checkoutUrl: string }
  | { kind: "checkout_in_progress" };

/** Expires this user's live sessions that are past their TTL, from another mode, or abandoned while pending. */
async function expireStaleSessions(admin: AdminClient, userId: string, mode: BillingMode): Promise<void> {
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - PENDING_TIMEOUT_MS).toISOString();
  const { error } = await admin
    .from("billing_checkout_sessions")
    .update({ status: "expired", updated_at: now.toISOString() })
    .eq("user_id", userId)
    .in("status", LIVE_STATUSES)
    .or(
      `expires_at.lte."${now.toISOString()}",mode.neq.${mode},and(status.eq.pending,created_at.lt."${pendingCutoff}")`
    );
  if (error) throw error;
}

async function getLiveSession(admin: AdminClient, userId: string): Promise<BillingCheckoutSessionRow | null> {
  const { data, error } = await admin
    .from("billing_checkout_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .in("status", LIVE_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return data as BillingCheckoutSessionRow | null;
}

/**
 * Returns the user's single live checkout, creating a Dodo session only when none
 * exists. The partial unique index on live sessions makes the reservation race-free.
 */
export async function createOrReuseCheckout(args: {
  account: BillingAccountRow;
  user: User;
  interval: BillingInterval;
  mode: BillingMode;
}): Promise<CheckoutResult> {
  const { account, user, interval, mode } = args;

  const blocking = findBlockingSubscription(account.billing_subscriptions, mode);
  if (blocking) {
    logger.warn("billing.checkout.blocked", { status: blocking.status });
    return { kind: blocking.status === "on_hold" ? "payment_failed" : "subscription_exists" };
  }

  const admin = createAdminClient();
  await expireStaleSessions(admin, account.id, mode);

  const { data: reserved, error: reserveError } = await admin
    .from("billing_checkout_sessions")
    .insert({
      user_id: account.id,
      mode,
      interval,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .select("id")
    .single();

  if (reserveError) {
    if (reserveError.code !== "23505") throw reserveError;

    const live = await getLiveSession(admin, account.id);
    if (!live || live.status === "pending" || !live.checkout_url) {
      logger.info("billing.checkout.in_progress", { mode });
      return { kind: "checkout_in_progress" };
    }
    if (live.interval !== interval) {
      logger.info("billing.checkout.other_interval_open", { mode, interval, openInterval: live.interval });
      return { kind: "checkout_open", interval: live.interval, checkoutUrl: live.checkout_url };
    }
    logger.info("billing.checkout.resumed", { mode, interval });
    return { kind: "ready", checkoutUrl: live.checkout_url, resumed: true };
  }

  const checkoutSessionId = reserved.id as string;
  let session: { session_id: string; checkout_url?: string | null };
  try {
    const customerId = await ensureDodoCustomer(account, user, mode);
    session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: getProductId(interval), quantity: 1 }],
      customer: { customer_id: customerId },
      subscription_data: { trial_period_days: remainingTrialDays(account.trial_ends_at) },
      metadata: { user_id: account.id, checkout_session_id: checkoutSessionId },
      return_url: `${getSiteUrl()}/settings/billing?checkout=success`,
      cancel_url: `${getSiteUrl()}/settings/billing`,
    });
    if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL");
  } catch (error) {
    // Free the slot so the user can try again.
    const { error: releaseError } = await admin
      .from("billing_checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", checkoutSessionId);
    if (releaseError) logger.error("billing.checkout.release_failed", releaseError, { mode });
    throw error;
  }

  const { error: openError } = await admin
    .from("billing_checkout_sessions")
    .update({
      status: "open",
      dodo_session_id: session.session_id,
      checkout_url: session.checkout_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkoutSessionId);
  // The Dodo session exists either way; let the user pay rather than fail here.
  if (openError) logger.error("billing.checkout.open_failed", openError, { mode, sessionId: session.session_id });

  logger.info("billing.checkout.succeeded", { interval, mode, sessionId: session.session_id });
  return { kind: "ready", checkoutUrl: session.checkout_url, resumed: false };
}
