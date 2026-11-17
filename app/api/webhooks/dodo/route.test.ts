import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real signatures go through the real dodo.webhooks.unwrap; only the DB layer is mocked.
// Factories (not automocks) keep react's cache and next/headers from loading.
const server = vi.hoisted(() => ({
  resolveSubscriptionOwner: vi.fn(),
  applySubscriptionSnapshot: vi.fn(),
  completeCheckoutSession: vi.fn(),
  detectDuplicateSubscriptions: vi.fn(),
}));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/billing/server", () => server);
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const WEBHOOK_SECRET_BYTES = Buffer.from("crolyo-test-webhook-secret-32byt");
const WEBHOOK_KEY = `whsec_${WEBHOOK_SECRET_BYTES.toString("base64")}`;
const USER_ID = "11111111-1111-1111-1111-111111111111";
const CHECKOUT_SESSION_ID = "22222222-2222-2222-2222-222222222222";

const ENV = {
  DODO_PAYMENTS_API_KEY: "test_api_key",
  DODO_PAYMENTS_WEBHOOK_KEY: WEBHOOK_KEY,
  DODO_PAYMENTS_ENVIRONMENT: "test_mode",
};

type RouteModule = typeof import("./route");

/** Fresh module graph so getDodoClient's singleton sees the env of the current test. */
async function loadRoute(env: Record<string, string | undefined> = ENV): Promise<RouteModule> {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./route");
}

function subscriptionData(overrides: Record<string, unknown> = {}) {
  return {
    subscription_id: "sub_test_1",
    status: "active",
    product_id: "pdt_monthly",
    customer: { customer_id: "cus_test_1", email: "buyer@example.com", name: "Buyer" },
    next_billing_date: "2026-12-02T00:00:00Z",
    cancel_at_next_billing_date: false,
    cancelled_at: null,
    past_due_ends_at: null,
    metadata: { user_id: USER_ID, checkout_session_id: CHECKOUT_SESSION_ID },
    payment_id: null,
    ...overrides,
  };
}

function event(type: string, data: unknown, timestamp = "2026-11-18T10:00:00Z") {
  return { business_id: "bus_test", type, timestamp, data };
}

/** Signs like standardwebhooks: base64(HMAC-SHA256(secret, `${id}.${ts}.${body}`)). */
function signedRequest(
  payload: unknown,
  options: { secret?: Buffer; timestampSeconds?: number; omitHeaders?: boolean; tamper?: boolean } = {}
): Request {
  const body = JSON.stringify(payload);
  const id = `msg_${randomUUID()}`;
  const timestamp = String(options.timestampSeconds ?? Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", options.secret ?? WEBHOOK_SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  const headers: Record<string, string> = options.omitHeaders
    ? {}
    : { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` };
  return new Request("http://localhost/api/webhooks/dodo", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: options.tamper ? body.replace("pdt_monthly", "pdt_annual") : body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  server.resolveSubscriptionOwner.mockResolvedValue(USER_ID);
  server.applySubscriptionSnapshot.mockResolvedValue(true);
  server.completeCheckoutSession.mockResolvedValue(false);
  server.detectDuplicateSubscriptions.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("billing lifecycle scenarios", () => {
  it("checkout success: subscription.active stores the sub and completes the checkout", async () => {
    const { POST } = await loadRoute();
    server.completeCheckoutSession.mockResolvedValue(true);

    const res = await POST(signedRequest(event("subscription.active", subscriptionData())));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: USER_ID,
        mode: "test",
        eventType: "subscription.active",
        eventAt: "2026-11-18T10:00:00Z",
        snapshot: expect.objectContaining({ subscription_id: "sub_test_1", status: "active" }),
      })
    );
    expect(server.completeCheckoutSession).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ metadata: expect.objectContaining({ checkout_session_id: CHECKOUT_SESSION_ID }) }),
      USER_ID
    );
    expect(logger.info).toHaveBeenCalledWith("billing.webhook.checkout_completed", expect.any(Object));
    expect(server.detectDuplicateSubscriptions).toHaveBeenCalledWith({}, USER_ID, "test");
  });

  it("checkout fail: payment.failed is acknowledged and changes nothing", async () => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event("payment.failed", { payment_id: "pay_1", status: "failed" })));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).not.toHaveBeenCalled();
    expect(server.completeCheckoutSession).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("billing.webhook.ignored", { eventType: "payment.failed" });
  });

  it("checkout fail: subscription.failed is stored without granting access", async () => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event("subscription.failed", subscriptionData({ status: "failed" }))));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventType: "subscription.failed", snapshot: expect.objectContaining({ status: "failed" }) })
    );
    expect(server.detectDuplicateSubscriptions).not.toHaveBeenCalled();
  });

  it.each([
    ["first charge after trial", "2026-12-02T00:00:00Z", "2027-01-02T00:00:00Z"],
    ["regular renewal", "2027-01-02T00:00:00Z", "2027-02-02T00:00:00Z"],
  ])("%s: subscription.renewed stores the new next_billing_date", async (_label, at, nextBillingDate) => {
    const { POST } = await loadRoute();

    const res = await POST(
      signedRequest(
        event("subscription.renewed", subscriptionData({ next_billing_date: nextBillingDate, payment_id: "pay_1" }), at)
      )
    );

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "subscription.renewed",
        eventAt: at,
        snapshot: expect.objectContaining({ status: "active", next_billing_date: nextBillingDate }),
      })
    );
    expect(server.detectDuplicateSubscriptions).toHaveBeenCalled();
  });

  it("renewal fail: subscription.on_hold is stored and skips the duplicate check", async () => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event("subscription.on_hold", subscriptionData({ status: "on_hold" }))));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ snapshot: expect.objectContaining({ status: "on_hold" }) })
    );
    expect(server.detectDuplicateSubscriptions).not.toHaveBeenCalled();
  });

  it("renewal fail with grace period: past_due inside the grace window counts as live", async () => {
    const { POST } = await loadRoute();
    const graceEnds = new Date(Date.now() + 3 * 86_400_000).toISOString();

    await POST(
      signedRequest(event("subscription.past_due", subscriptionData({ status: "past_due", past_due_ends_at: graceEnds })))
    );

    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ snapshot: expect.objectContaining({ status: "past_due", past_due_ends_at: graceEnds }) })
    );
    expect(server.detectDuplicateSubscriptions).toHaveBeenCalled();
  });

  it("renewal fail: past_due after the grace window skips the duplicate check", async () => {
    const { POST } = await loadRoute();

    await POST(
      signedRequest(
        event("subscription.past_due", subscriptionData({ status: "past_due", past_due_ends_at: "2026-01-01T00:00:00Z" }))
      )
    );

    expect(server.applySubscriptionSnapshot).toHaveBeenCalled();
    expect(server.detectDuplicateSubscriptions).not.toHaveBeenCalled();
  });

  it.each([
    ["recovery", "subscription.active", { status: "active" }],
    ["cancel at period end", "subscription.updated", { status: "active", cancel_at_next_billing_date: true }],
    ["cancelled", "subscription.cancelled", { status: "cancelled", cancelled_at: "2026-11-18T09:00:00Z" }],
    ["expired", "subscription.expired", { status: "expired", next_billing_date: null }],
    ["plan change", "subscription.plan_changed", { status: "active", product_id: "pdt_annual" }],
  ])("%s: %s persists the snapshot fields", async (_label, type, fields) => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event(type, subscriptionData(fields))));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventType: type, snapshot: expect.objectContaining(fields) })
    );
  });
});

describe("delivery and ordering", () => {
  it("orders by the event timestamp, not the per-retry webhook-timestamp header", async () => {
    const { POST } = await loadRoute();

    await POST(signedRequest(event("subscription.active", subscriptionData(), "2026-11-01T00:00:00Z")));

    expect(server.applySubscriptionSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventAt: "2026-11-01T00:00:00Z" })
    );
  });

  it("a stale (out-of-order) event is acknowledged without completing the checkout", async () => {
    const { POST } = await loadRoute();
    server.applySubscriptionSnapshot.mockResolvedValue(false);

    const res = await POST(signedRequest(event("subscription.active", subscriptionData())));

    expect(res.status).toBe(200);
    expect(server.completeCheckoutSession).not.toHaveBeenCalled();
    expect(server.detectDuplicateSubscriptions).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("billing.webhook.subscription_stale", expect.any(Object));
  });

  it("an unknown owner is acknowledged so Dodo stops retrying", async () => {
    const { POST } = await loadRoute();
    server.resolveSubscriptionOwner.mockResolvedValue(null);

    const res = await POST(signedRequest(event("subscription.active", subscriptionData())));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("billing.webhook.owner_not_found", expect.any(Object));
  });

  it("a user deleted mid-flight (FK 23503) is acknowledged", async () => {
    const { POST } = await loadRoute();
    server.applySubscriptionSnapshot.mockRejectedValue({ code: "23503" });

    const res = await POST(signedRequest(event("subscription.active", subscriptionData())));

    expect(res.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith("billing.webhook.owner_deleted", expect.any(Object));
  });

  it("any other DB failure returns 500 so Dodo retries", async () => {
    const { POST } = await loadRoute();
    server.applySubscriptionSnapshot.mockRejectedValue(new Error("connection reset"));

    const res = await POST(signedRequest(event("subscription.renewed", subscriptionData())));

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("billing.webhook.processing_failed", expect.any(Error), expect.any(Object));
  });

  it("a malformed subscription payload is acknowledged and logged", async () => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event("subscription.active", { subscription_id: "sub_1" })));

    expect(res.status).toBe(200);
    expect(server.applySubscriptionSnapshot).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("billing.webhook.payload_invalid", null, { eventType: "subscription.active" });
  });

  it.each(["payment.succeeded", "refund.succeeded", "dispute.opened"])("%s is ignored", async (type) => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event(type, { payment_id: "pay_1" })));

    expect(res.status).toBe(200);
    expect(server.resolveSubscriptionOwner).not.toHaveBeenCalled();
  });
});

describe("signature verification", () => {
  it.each([
    ["wrong secret", { secret: Buffer.from("not-the-real-secret-at-all-12345") }],
    ["tampered body", { tamper: true }],
    ["missing headers", { omitHeaders: true }],
    ["replayed after 10 minutes", { timestampSeconds: Math.floor(Date.now() / 1000) - 600 }],
  ])("rejects %s with 401", async (_label, options) => {
    const { POST } = await loadRoute();

    const res = await POST(signedRequest(event("subscription.active", subscriptionData()), options));

    expect(res.status).toBe(401);
    expect(server.resolveSubscriptionOwner).not.toHaveBeenCalled();
  });

  it("returns 500 when Dodo credentials are missing", async () => {
    const { POST } = await loadRoute({ ...ENV, DODO_PAYMENTS_WEBHOOK_KEY: undefined });

    const res = await POST(signedRequest(event("subscription.active", subscriptionData())));

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("billing.webhook.configuration_missing", expect.any(Error));
  });
});
