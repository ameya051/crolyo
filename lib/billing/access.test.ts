import { describe, expect, it } from "vitest";

import {
  findBlockingSubscription,
  getAccessState,
  isInTrialPeriod,
  subscriptionGrantsAccess,
} from "@/lib/billing/access";
import type { BillingAccessRow, BillingSubscriptionRow } from "@/lib/types";

// The row each webhook scenario leaves behind, and what the user should see as a result.
const NOW = new Date("2026-11-18T12:00:00Z");
const TRIAL_RUNNING = "2026-11-25T12:00:00Z";
const TRIAL_OVER = "2026-11-10T12:00:00Z";

function sub(overrides: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    dodo_subscription_id: "sub_1",
    mode: "test",
    product_id: "pdt_monthly",
    status: "active",
    next_billing_date: "2026-12-18T12:00:00Z",
    cancel_at_next_billing_date: false,
    past_due_ends_at: null,
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function account(trialEndsAt: string, subscriptions: BillingSubscriptionRow[]): BillingAccessRow {
  return { trial_ends_at: trialEndsAt, billing_subscriptions: subscriptions };
}

describe("isInTrialPeriod (billing page 'Free until' copy)", () => {
  it("is true when Dodo's next charge is the trial-end charge", () => {
    expect(isInTrialPeriod({ next_billing_date: TRIAL_RUNNING }, TRIAL_RUNNING, NOW)).toBe(true);
  });

  it("allows a day of slack for the trial being rounded up at checkout", () => {
    expect(isInTrialPeriod({ next_billing_date: "2026-11-26T11:00:00Z" }, TRIAL_RUNNING, NOW)).toBe(true);
  });

  it("is false once Dodo charged early and moved the next charge a full period out", () => {
    // The app trial still runs, but Dodo already took the first payment.
    expect(isInTrialPeriod({ next_billing_date: "2027-11-18T12:00:00Z" }, TRIAL_RUNNING, NOW)).toBe(false);
  });

  it("is false after the app trial ended", () => {
    expect(isInTrialPeriod({ next_billing_date: "2026-11-10T12:00:00Z" }, TRIAL_OVER, NOW)).toBe(false);
  });

  it("is false without a next billing date or trial end", () => {
    expect(isInTrialPeriod({ next_billing_date: null }, TRIAL_RUNNING, NOW)).toBe(false);
    expect(isInTrialPeriod({ next_billing_date: TRIAL_RUNNING }, null, NOW)).toBe(false);
  });
});

describe("access after each webhook scenario", () => {
  it("checkout success during the app trial: subscribed", () => {
    const state = getAccessState(account(TRIAL_RUNNING, [sub()]), "test", NOW);
    expect(state).toMatchObject({ kind: "subscribed", hasAccess: true, trialDaysLeft: 7 });
  });

  it("first charge after trial / renewal success: still subscribed once the trial is over", () => {
    const state = getAccessState(account(TRIAL_OVER, [sub()]), "test", NOW);
    expect(state).toMatchObject({ kind: "subscribed", hasAccess: true, trialDaysLeft: 0 });
  });

  it("checkout fail: a failed subscription grants nothing and does not block a retry", () => {
    const failed = sub({ status: "failed" });
    expect(getAccessState(account(TRIAL_OVER, [failed]), "test", NOW)).toMatchObject({
      kind: "expired",
      hasAccess: false,
    });
    expect(findBlockingSubscription([failed], "test")).toBeNull();
  });

  it("checkout fail while the trial runs: the user keeps trial access", () => {
    const state = getAccessState(account(TRIAL_RUNNING, [sub({ status: "failed" })]), "test", NOW);
    expect(state).toMatchObject({ kind: "trialing", hasAccess: true, subscription: null });
  });

  it("renewal fail after trial: on_hold means payment_failed, no access, checkout blocked", () => {
    const onHold = sub({ status: "on_hold" });
    expect(getAccessState(account(TRIAL_OVER, [onHold]), "test", NOW)).toMatchObject({
      kind: "payment_failed",
      hasAccess: false,
      subscription: { status: "on_hold" },
    });
    // createOrReuseCheckout maps a blocking on_hold sub to { kind: "payment_failed" }.
    expect(findBlockingSubscription([onHold], "test")?.status).toBe("on_hold");
  });

  it("first charge after trial fails while the app trial still has days left: trialing", () => {
    const state = getAccessState(account(TRIAL_RUNNING, [sub({ status: "on_hold" })]), "test", NOW);
    expect(state).toMatchObject({ kind: "trialing", hasAccess: true, subscription: { status: "on_hold" } });
  });

  it("renewal fail with grace period: past_due keeps access until past_due_ends_at", () => {
    const pastDue = sub({ status: "past_due", past_due_ends_at: "2026-11-20T00:00:00Z" });
    expect(getAccessState(account(TRIAL_OVER, [pastDue]), "test", NOW)).toMatchObject({
      kind: "past_due",
      hasAccess: true,
    });
    expect(subscriptionGrantsAccess(pastDue, new Date("2026-11-21T00:00:00Z"))).toBe(false);
    expect(getAccessState(account(TRIAL_OVER, [pastDue]), "test", new Date("2026-11-21T00:00:00Z"))).toMatchObject({
      kind: "expired",
      hasAccess: false,
    });
  });

  it("recovery: on_hold back to active restores access", () => {
    const state = getAccessState(account(TRIAL_OVER, [sub({ status: "active" })]), "test", NOW);
    expect(state.hasAccess).toBe(true);
  });

  it("cancel at period end: access continues until Dodo ends it", () => {
    const state = getAccessState(account(TRIAL_OVER, [sub({ cancel_at_next_billing_date: true })]), "test", NOW);
    expect(state).toMatchObject({ kind: "subscribed", subscription: { cancel_at_next_billing_date: true } });
  });

  it.each(["cancelled", "expired"])("%s after trial: no access and a new checkout is allowed", (status) => {
    const ended = sub({ status });
    expect(getAccessState(account(TRIAL_OVER, [ended]), "test", NOW)).toMatchObject({
      kind: "expired",
      hasAccess: false,
    });
    expect(findBlockingSubscription([ended], "test")).toBeNull();
  });

  it("resubscribing after a cancellation: the new active sub wins over the old one", () => {
    const state = getAccessState(
      account(TRIAL_OVER, [
        sub({ dodo_subscription_id: "sub_old", status: "cancelled", created_at: "2026-10-01T00:00:00Z" }),
        sub({ dodo_subscription_id: "sub_new", status: "active", created_at: "2026-11-15T00:00:00Z" }),
      ]),
      "test",
      NOW
    );
    expect(state).toMatchObject({ kind: "subscribed", subscription: { dodo_subscription_id: "sub_new" } });
    expect(state.hasDuplicateSubscriptions).toBe(false);
  });

  it("double checkout: two live subs are flagged as duplicates", () => {
    const state = getAccessState(
      account(TRIAL_OVER, [sub({ dodo_subscription_id: "sub_a" }), sub({ dodo_subscription_id: "sub_b" })]),
      "test",
      NOW
    );
    expect(state.hasDuplicateSubscriptions).toBe(true);
  });

  it("a test-mode subscription never grants access in live mode", () => {
    const state = getAccessState(account(TRIAL_OVER, [sub({ mode: "test" })]), "live", NOW);
    expect(state).toMatchObject({ kind: "expired", hasAccess: false });
    expect(findBlockingSubscription([sub({ mode: "test" })], "live")).toBeNull();
  });
});
