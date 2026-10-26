import type {
  AccessState,
  BillingAccessRow,
  BillingMode,
  BillingSubscriptionRow,
} from "@/lib/types";

const DAY_MS = 86_400_000;

/** Statuses that should stop a new checkout: the user already has (or is recovering) a plan. */
const BLOCKING_STATUSES = new Set(["active", "past_due", "on_hold", "paused"]);

/** Select for access checks on a `users` row (directly or as an embed). */
export const BILLING_ACCESS_SELECT =
  "trial_ends_at, billing_subscriptions(dodo_subscription_id, mode, product_id, status, next_billing_date, cancel_at_next_billing_date, past_due_ends_at, created_at)";

/** PostgREST returns one-to-one embeds as an object, but tolerate an array. */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function remainingTrialDays(trialEndsAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / DAY_MS));
}

export function subscriptionGrantsAccess(
  subscription: { status: string; past_due_ends_at?: string | null },
  now = new Date()
): boolean {
  if (subscription.status === "active") return true;
  if (subscription.status === "past_due") {
    return !subscription.past_due_ends_at || new Date(subscription.past_due_ends_at) > now;
  }
  return false;
}

function subscriptionsForMode(
  subscriptions: BillingSubscriptionRow[] | null,
  mode: BillingMode
): BillingSubscriptionRow[] {
  return (subscriptions ?? [])
    .filter((subscription) => subscription.mode === mode)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function findBlockingSubscription(
  subscriptions: BillingSubscriptionRow[] | null,
  mode: BillingMode
): BillingSubscriptionRow | null {
  return subscriptionsForMode(subscriptions, mode).find((s) => BLOCKING_STATUSES.has(s.status)) ?? null;
}

/**
 * Single source of truth for whether a user's sites are live. Only subscriptions
 * from the app's current billing mode count; the app-managed trial is mode-agnostic.
 */
export function getAccessState(
  account: BillingAccessRow | null,
  mode: BillingMode,
  now = new Date()
): AccessState {
  const subscriptions = subscriptionsForMode(account?.billing_subscriptions ?? null, mode);
  const granting = subscriptions.filter((s) => subscriptionGrantsAccess(s, now));
  const trialEndsAt = account?.trial_ends_at ?? null;
  const base = {
    trialEndsAt,
    trialDaysLeft: trialEndsAt ? remainingTrialDays(trialEndsAt, now) : 0,
    hasDuplicateSubscriptions: granting.length > 1,
  };

  const active = granting.find((s) => s.status === "active");
  if (active) return { ...base, kind: "subscribed", hasAccess: true, subscription: active };

  const pastDue = granting.find((s) => s.status === "past_due");
  if (pastDue) return { ...base, kind: "past_due", hasAccess: true, subscription: pastDue };

  if (trialEndsAt && new Date(trialEndsAt) > now) {
    return {
      ...base,
      kind: "trialing",
      hasAccess: true,
      subscription: findBlockingSubscription(subscriptions, mode),
    };
  }

  const onHold = subscriptions.find((s) => s.status === "on_hold");
  if (onHold) return { ...base, kind: "payment_failed", hasAccess: false, subscription: onHold };

  return { ...base, kind: "expired", hasAccess: false, subscription: null };
}
