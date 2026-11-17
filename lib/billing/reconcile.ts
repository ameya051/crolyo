import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getBillingMode, getDodoClient } from "@/lib/billing/dodo";
import {
  applySubscriptionSnapshot,
  completeCheckoutSession,
  detectDuplicateSubscriptions,
  resolveSubscriptionOwner,
} from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingMode } from "@/lib/types";
import { dodoSubscriptionSchema, type DodoSubscriptionSnapshot } from "@/lib/validations/billing";

/**
 * Backstop for webhooks that never arrive or are dropped. Pulls the current
 * subscription from Dodo and writes it through the same ordered upsert the
 * webhook uses, so reconciliation and webhooks can never overwrite each other
 * with older state.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** Statuses Dodo can still move away from; final ones are never re-checked. */
const NON_FINAL_STATUSES = ["active", "past_due", "on_hold", "paused", "pending"] as const;
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const FULL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FULL_CHECK_LIMIT = 50;
const BATCH_SIZE = 5;
const STORED_SELECT =
  "dodo_subscription_id, user_id, status, product_id, next_billing_date, cancel_at_next_billing_date, cancelled_at, past_due_ends_at";

type StoredSubscription = {
  dodo_subscription_id: string;
  user_id: string;
  status: string;
  product_id: string;
  next_billing_date: string | null;
  cancel_at_next_billing_date: boolean;
  cancelled_at: string | null;
  past_due_ends_at: string | null;
};

export type SyncOutcome = "unchanged" | "corrected" | "recovered" | "superseded" | "owner_not_found";

export type ReconcileSummary = {
  recovered: number;
  corrected: number;
  checked: number;
  failed: number;
  incomplete: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return new Date(a).getTime() === new Date(b).getTime();
}

/** Names of persisted fields where Dodo's snapshot differs from our row; every field when there is no row. */
export function diffSnapshot(stored: StoredSubscription | null, snapshot: DodoSubscriptionSnapshot): string[] {
  if (!stored) return ["*"];
  const changed: string[] = [];
  if (stored.status !== snapshot.status) changed.push("status");
  if (stored.product_id !== snapshot.product_id) changed.push("product_id");
  if (stored.cancel_at_next_billing_date !== (snapshot.cancel_at_next_billing_date ?? false)) {
    changed.push("cancel_at_next_billing_date");
  }
  for (const field of ["next_billing_date", "cancelled_at", "past_due_ends_at"] as const) {
    if (!sameInstant(stored[field], snapshot[field])) changed.push(field);
  }
  return changed;
}

/**
 * Runs `work` over `items` in concurrent batches, starting no new batch once
 * `deadline` has passed. Work already started always finishes. Per-item errors
 * go to `onError` and never stop the run.
 */
export async function runBatched<T>(
  items: readonly T[],
  work: (item: T) => Promise<void>,
  options: { deadline: number; batchSize?: number; now?: () => number; onError: (item: T, error: unknown) => void }
): Promise<{ incomplete: boolean }> {
  const { deadline, batchSize = BATCH_SIZE, now = Date.now, onError } = options;
  for (let i = 0; i < items.length; i += batchSize) {
    if (now() >= deadline) return { incomplete: true };
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((item) => work(item)));
    results.forEach((result, index) => {
      if (result.status === "rejected") onError(batch[index], result.reason);
    });
  }
  return { incomplete: false };
}

// ---------------------------------------------------------------------------
// Single-subscription sync
// ---------------------------------------------------------------------------

async function loadStored(admin: AdminClient, mode: BillingMode, subscriptionId: string) {
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select(STORED_SELECT)
    .eq("dodo_subscription_id", subscriptionId)
    .eq("mode", mode)
    .maybeSingle();
  if (error) throw error;
  return data as StoredSubscription | null;
}

async function markReconciled(admin: AdminClient, subscriptionId: string): Promise<void> {
  const { error } = await admin
    .from("billing_subscriptions")
    .update({ reconciled_at: new Date().toISOString() })
    .eq("dodo_subscription_id", subscriptionId);
  if (error) throw error;
}

/** Brings one subscription in line with Dodo. Safe to run alongside webhooks. */
export async function syncSubscription(
  admin: AdminClient,
  mode: BillingMode,
  subscriptionId: string,
  knownUserId?: string
): Promise<SyncOutcome> {
  // Captured before the fetch: a webhook for a change made after this moment
  // carries a later timestamp and still wins over this snapshot.
  const startedAt = new Date().toISOString();
  const snapshot = dodoSubscriptionSchema.parse(await getDodoClient().subscriptions.retrieve(subscriptionId));
  const context = { mode, subscriptionId, status: snapshot.status };

  const stored = await loadStored(admin, mode, subscriptionId);
  const changed = diffSnapshot(stored, snapshot);
  if (changed.length === 0) {
    await markReconciled(admin, subscriptionId);
    return "unchanged";
  }

  const userId = stored?.user_id ?? knownUserId ?? (await resolveSubscriptionOwner(admin, snapshot, mode));
  if (!userId) {
    logger.warn("billing.reconcile.owner_not_found", context);
    return "owner_not_found";
  }

  const applied = await applySubscriptionSnapshot(admin, {
    userId,
    mode,
    snapshot,
    eventType: "reconcile",
    eventAt: startedAt,
  });
  if (!applied) {
    // A webhook landed between our fetch and our write; its state is newer.
    logger.info("billing.reconcile.superseded", context);
    await markReconciled(admin, subscriptionId);
    return "superseded";
  }

  if (stored) {
    logger.warn("billing.reconcile.drift_corrected", { ...context, changed });
  } else {
    logger.warn("billing.reconcile.subscription_recovered", context);
  }
  await completeCheckoutSession(admin, snapshot, userId);
  if (subscriptionGrantsAccess(snapshot)) await detectDuplicateSubscriptions(admin, userId, mode);
  await markReconciled(admin, subscriptionId);
  return stored ? "corrected" : "recovered";
}

// ---------------------------------------------------------------------------
// Checkout return: one customer, right now
// ---------------------------------------------------------------------------

/** Syncs a customer's recent subscriptions. Used when they land back from checkout. */
export async function syncCustomerSubscriptions(
  mode: BillingMode,
  account: { id: string; dodoCustomerId: string }
): Promise<SyncOutcome[]> {
  const admin = createAdminClient();
  const outcomes: SyncOutcome[] = [];
  const createdAfter = new Date(Date.now() - CUSTOMER_WINDOW_MS).toISOString();
  for await (const subscription of getDodoClient().subscriptions.list({
    customer_id: account.dodoCustomerId,
    created_at_gte: createdAfter,
  })) {
    outcomes.push(await syncSubscription(admin, mode, subscription.subscription_id, account.id));
  }
  return outcomes;
}

// ---------------------------------------------------------------------------
// Scheduled sweep
// ---------------------------------------------------------------------------

/** Pass A: subscriptions created recently in Dodo that we have no row for. */
async function findUnrecorded(admin: AdminClient, mode: BillingMode, deadline: number): Promise<string[]> {
  const createdAfter = new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();
  const remoteIds: string[] = [];
  for await (const subscription of getDodoClient().subscriptions.list({ created_at_gte: createdAfter })) {
    remoteIds.push(subscription.subscription_id);
    if (Date.now() >= deadline) break;
  }
  if (remoteIds.length === 0) return [];

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("dodo_subscription_id")
    .eq("mode", mode)
    .in("dodo_subscription_id", remoteIds);
  if (error) throw error;
  const known = new Set((data ?? []).map((row) => row.dodo_subscription_id as string));
  return remoteIds.filter((id) => !known.has(id));
}

/** Pass B: rows where Dodo should already have told us something (renewal, grace end, pending). */
async function findDue(admin: AdminClient, mode: BillingMode): Promise<string[]> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("dodo_subscription_id")
    .eq("mode", mode)
    .in("status", NON_FINAL_STATUSES)
    .or(`next_billing_date.lt."${now}",past_due_ends_at.lt."${now}",status.eq.pending`);
  if (error) throw error;
  return (data ?? []).map((row) => row.dodo_subscription_id as string);
}

/** Pass C: everything else not checked in the last day, stalest first, capped per run. */
async function findStale(admin: AdminClient, mode: BillingMode, exclude: Set<string>): Promise<string[]> {
  const cutoff = new Date(Date.now() - FULL_CHECK_INTERVAL_MS).toISOString();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("dodo_subscription_id")
    .eq("mode", mode)
    .in("status", NON_FINAL_STATUSES)
    .or(`reconciled_at.is.null,reconciled_at.lt."${cutoff}"`)
    .order("reconciled_at", { ascending: true, nullsFirst: true })
    .limit(FULL_CHECK_LIMIT + exclude.size);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.dodo_subscription_id as string)
    .filter((id) => !exclude.has(id))
    .slice(0, FULL_CHECK_LIMIT);
}

export async function reconcileSubscriptions({ deadline }: { deadline: number }): Promise<ReconcileSummary> {
  const admin = createAdminClient();
  const mode = getBillingMode();
  const summary: ReconcileSummary = { recovered: 0, corrected: 0, checked: 0, failed: 0, incomplete: false };

  const sync = async (subscriptionId: string) => {
    const outcome = await syncSubscription(admin, mode, subscriptionId);
    summary.checked += 1;
    if (outcome === "recovered") summary.recovered += 1;
    if (outcome === "corrected") summary.corrected += 1;
  };
  const onError = (subscriptionId: string, error: unknown) => {
    summary.failed += 1;
    logger.error("billing.reconcile.item_failed", error, { mode, subscriptionId });
  };

  // In priority order: paid-but-unrecorded first, then rows that should already
  // have changed, then the rolling full check. Ids handled by an earlier pass are skipped.
  const seen = new Set<string>();
  const passes = [
    () => findUnrecorded(admin, mode, deadline),
    () => findDue(admin, mode),
    () => findStale(admin, mode, seen),
  ];

  for (const pass of passes) {
    if (Date.now() >= deadline) {
      summary.incomplete = true;
      break;
    }
    const ids = (await pass()).filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    const { incomplete } = await runBatched(ids, sync, { deadline, onError });
    if (incomplete) {
      summary.incomplete = true;
      break;
    }
  }

  return summary;
}
