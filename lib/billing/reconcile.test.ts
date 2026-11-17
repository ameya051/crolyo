import { describe, expect, it, vi } from "vitest";

import { diffSnapshot, runBatched } from "@/lib/billing/reconcile";
import type { DodoSubscriptionSnapshot } from "@/lib/validations/billing";

const stored = {
  dodo_subscription_id: "sub_1",
  user_id: "11111111-1111-1111-1111-111111111111",
  status: "active",
  product_id: "pdt_monthly",
  next_billing_date: "2026-12-16T00:00:00+00:00",
  cancel_at_next_billing_date: false,
  cancelled_at: null,
  past_due_ends_at: null,
};

function snapshotOf(overrides: Partial<DodoSubscriptionSnapshot> = {}): DodoSubscriptionSnapshot {
  return {
    subscription_id: "sub_1",
    status: "active",
    product_id: "pdt_monthly",
    customer: { customer_id: "cus_1" },
    next_billing_date: "2026-12-16T00:00:00Z",
    cancel_at_next_billing_date: false,
    cancelled_at: null,
    past_due_ends_at: null,
    ...overrides,
  };
}

describe("diffSnapshot", () => {
  it("reports nothing when Dodo matches the row", () => {
    expect(diffSnapshot(stored, snapshotOf())).toEqual([]);
  });

  it("treats the same instant in a different format as unchanged", () => {
    // Postgres returns +00:00; Dodo returns Z with milliseconds.
    expect(diffSnapshot(stored, snapshotOf({ next_billing_date: "2026-12-16T00:00:00.000Z" }))).toEqual([]);
  });

  it("treats null and missing optional fields as equal", () => {
    expect(
      diffSnapshot(stored, snapshotOf({ cancelled_at: undefined, past_due_ends_at: undefined, cancel_at_next_billing_date: undefined }))
    ).toEqual([]);
  });

  it("names each field that drifted", () => {
    const drifted = snapshotOf({
      status: "cancelled",
      next_billing_date: "2027-01-16T00:00:00Z",
      cancelled_at: "2026-11-17T10:00:00Z",
    });
    expect(diffSnapshot(stored, drifted)).toEqual(["status", "next_billing_date", "cancelled_at"]);
  });

  it("flags a date that went from set to null", () => {
    expect(diffSnapshot(stored, snapshotOf({ next_billing_date: null }))).toEqual(["next_billing_date"]);
  });

  it("marks a subscription with no row as fully different", () => {
    expect(diffSnapshot(null, snapshotOf())).toEqual(["*"]);
  });
});

describe("runBatched", () => {
  it("processes every item in batches when there is time", async () => {
    const seen: number[] = [];
    const result = await runBatched([1, 2, 3, 4, 5, 6, 7], async (n) => void seen.push(n), {
      deadline: Number.POSITIVE_INFINITY,
      batchSize: 3,
      onError: () => {},
    });
    expect(result).toEqual({ incomplete: false });
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("starts no batch after the deadline but finishes the one in flight", async () => {
    let clock = 0;
    const started: number[] = [];
    const finished: number[] = [];
    const result = await runBatched(
      [1, 2, 3, 4, 5],
      async (n) => {
        started.push(n);
        clock = 100; // the first batch runs past the deadline
        await Promise.resolve();
        finished.push(n);
      },
      { deadline: 50, batchSize: 2, now: () => clock, onError: () => {} }
    );
    expect(result).toEqual({ incomplete: true });
    expect(started).toEqual([1, 2]);
    expect(finished).toEqual([1, 2]);
  });

  it("does nothing when the deadline has already passed", async () => {
    const work = vi.fn(async () => {});
    const result = await runBatched([1, 2], work, { deadline: 0, now: () => 1, onError: () => {} });
    expect(result).toEqual({ incomplete: true });
    expect(work).not.toHaveBeenCalled();
  });

  it("reports a failing item and keeps going", async () => {
    const errors: number[] = [];
    const done: number[] = [];
    const result = await runBatched(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("boom");
        done.push(n);
      },
      { deadline: Number.POSITIVE_INFINITY, batchSize: 2, onError: (n) => errors.push(n) }
    );
    expect(result).toEqual({ incomplete: false });
    expect(errors).toEqual([2]);
    expect(done).toEqual([1, 3]);
  });
});
