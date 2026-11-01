import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { BILLING_ACCESS_SELECT } from "@/lib/billing/access";
import { getDodoClient } from "@/lib/billing/dodo";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BillingAccountRow, BillingMode } from "@/lib/types";
import type { DodoSubscriptionSnapshot } from "@/lib/validations/billing";

type AdminClient = ReturnType<typeof createAdminClient>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user's billing account, read through RLS. Deduplicated per request. */
export const getCurrentBillingAccount = cache(async (): Promise<BillingAccountRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(`id, billing_mode, dodo_customer_id, ${BILLING_ACCESS_SELECT}`)
    .maybeSingle();

  if (error) {
    logger.error("billing.account.load_failed", error, { errorCode: error.code });
    return null;
  }
  return data as BillingAccountRow | null;
});

/** The user's Dodo customer id, but only if it was created in `mode`. */
export function customerIdFor(account: BillingAccountRow | null, mode: BillingMode): string | null {
  return account?.billing_mode === mode ? account.dodo_customer_id : null;
}

function displayName(user: User): string {
  return (
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Crolyo user"
  );
}

/**
 * Returns the user's Dodo customer for `mode`, creating it on first checkout so
 * every later webhook can be matched through our own customer mapping.
 */
export async function ensureDodoCustomer(
  account: BillingAccountRow,
  user: User,
  mode: BillingMode
): Promise<string> {
  const existing = customerIdFor(account, mode);
  if (existing) return existing;

  if (!user.email) throw new Error("Cannot create a Dodo customer without an email");

  const customer = await getDodoClient().customers.create({
    email: user.email,
    name: displayName(user),
    metadata: { user_id: account.id },
  });

  // Only claim the slot if no customer exists yet for this mode, so a concurrent
  // checkout can't overwrite the other's customer.
  const admin = createAdminClient();
  const { data: claimed, error } = await admin
    .from("users")
    .update({ billing_mode: mode, dodo_customer_id: customer.customer_id })
    .eq("id", account.id)
    .or(`billing_mode.is.null,billing_mode.neq.${mode}`)
    .select("id");
  if (error) throw error;
  if (claimed.length > 0) {
    logger.info("billing.customer.created", { mode });
    return customer.customer_id;
  }

  // A concurrent checkout claimed the slot first; use its customer.
  const { data, error: readError } = await admin
    .from("users")
    .select("dodo_customer_id")
    .eq("id", account.id)
    .eq("billing_mode", mode)
    .single();
  if (readError || !data?.dodo_customer_id) {
    throw readError ?? new Error("Billing customer disappeared after conflict");
  }
  logger.warn("billing.customer.claim_lost", { mode });
  return data.dodo_customer_id as string;
}

/** Maps a Dodo subscription to our user id, preferring our own customer mapping. */
export async function resolveSubscriptionOwner(
  admin: AdminClient,
  snapshot: DodoSubscriptionSnapshot,
  mode: BillingMode
): Promise<string | null> {
  const { data: customer, error: customerError } = await admin
    .from("users")
    .select("id")
    .eq("dodo_customer_id", snapshot.customer.customer_id)
    .eq("billing_mode", mode)
    .maybeSingle();
  if (customerError) throw customerError;
  if (customer) return customer.id as string;

  const { data: subscription, error: subscriptionError } = await admin
    .from("billing_subscriptions")
    .select("user_id")
    .eq("dodo_subscription_id", snapshot.subscription_id)
    .eq("mode", mode)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (subscription) return subscription.user_id as string;

  const metadataUserId = snapshot.metadata?.user_id;
  if (typeof metadataUserId !== "string" || !UUID_PATTERN.test(metadataUserId)) return null;

  const { data: account, error: accountError } = await admin
    .from("users")
    .select("id")
    .eq("id", metadataUserId)
    .maybeSingle();
  if (accountError) throw accountError;
  return account ? (account.id as string) : null;
}

/** Ordered upsert; returns false when a newer event was already applied. */
export async function applySubscriptionSnapshot(
  admin: AdminClient,
  args: {
    userId: string;
    mode: BillingMode;
    snapshot: DodoSubscriptionSnapshot;
    eventType: string;
    eventAt: string;
  }
): Promise<boolean> {
  const { snapshot } = args;
  const { data, error } = await admin.rpc("apply_dodo_subscription", {
    p_subscription_id: snapshot.subscription_id,
    p_user_id: args.userId,
    p_mode: args.mode,
    p_customer_id: snapshot.customer.customer_id,
    p_product_id: snapshot.product_id,
    p_status: snapshot.status,
    p_next_billing_date: snapshot.next_billing_date ?? null,
    p_cancel_at_next_billing_date: snapshot.cancel_at_next_billing_date ?? false,
    p_cancelled_at: snapshot.cancelled_at ?? null,
    p_past_due_ends_at: snapshot.past_due_ends_at ?? null,
    p_event_type: args.eventType,
    p_event_at: args.eventAt,
  });
  if (error) throw error;
  return data === true;
}

/**
 * Closes the checkout that created a subscription, freeing the user's checkout slot.
 * `expired` is included because a payment can land after our local TTL. Idempotent.
 */
export async function completeCheckoutSession(
  admin: AdminClient,
  snapshot: DodoSubscriptionSnapshot,
  userId: string
): Promise<boolean> {
  const checkoutSessionId = snapshot.metadata?.checkout_session_id;
  if (typeof checkoutSessionId !== "string" || !UUID_PATTERN.test(checkoutSessionId)) return false;

  const { data, error } = await admin
    .from("billing_checkout_sessions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", checkoutSessionId)
    .eq("user_id", userId)
    .in("status", ["pending", "open", "expired"])
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Two live subscriptions means a double charge; surface it for a manual refund. */
export async function detectDuplicateSubscriptions(
  admin: AdminClient,
  userId: string,
  mode: BillingMode
): Promise<void> {
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("dodo_subscription_id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .in("status", ["active", "past_due"]);
  if (error) throw error;

  if ((data?.length ?? 0) > 1) {
    logger.warn("billing.subscription.duplicate_detected", {
      userId,
      mode,
      subscriptionIds: data!.map((row) => row.dodo_subscription_id as string),
    });
  }
}
