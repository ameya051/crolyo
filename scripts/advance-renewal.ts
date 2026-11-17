/**
 * Triggers a Dodo test-mode renewal by moving a subscription's next_billing_date
 * to just ahead of now. Dodo then charges the subscription and sends the real,
 * signed webhooks to the configured endpoint.
 *
 * Usage: bun run billing:advance <subscription_id> [--in <seconds>]
 *
 * Refuses to run unless DODO_PAYMENTS_ENVIRONMENT is test_mode, and pins the
 * client to test_mode regardless, so it can never touch a live subscription.
 */
import DodoPayments from "dodopayments";

const DEFAULT_DELAY_SECONDS = 60;

function fail(message: string): never {
  console.error(`advance-renewal: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { subscriptionId: string; delaySeconds: number } {
  const [subscriptionId, flag, value, ...rest] = argv;
  const usage = "usage: bun run billing:advance <subscription_id> [--in <seconds>]";

  if (!subscriptionId || subscriptionId.startsWith("-") || rest.length > 0) fail(usage);
  if (flag === undefined) return { subscriptionId, delaySeconds: DEFAULT_DELAY_SECONDS };
  if (flag !== "--in" || value === undefined) fail(usage);

  const delaySeconds = Number(value);
  // Dodo rejects past dates; a few seconds of slack covers clock skew and latency.
  if (!Number.isInteger(delaySeconds) || delaySeconds < 10) fail("--in must be an integer of at least 10 seconds");
  return { subscriptionId, delaySeconds };
}

async function main() {
  const { subscriptionId, delaySeconds } = parseArgs(process.argv.slice(2));

  if (process.env.DODO_PAYMENTS_ENVIRONMENT !== "test_mode") {
    fail(`DODO_PAYMENTS_ENVIRONMENT is "${process.env.DODO_PAYMENTS_ENVIRONMENT ?? ""}"; this script only runs in test_mode`);
  }
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  if (!bearerToken) fail("DODO_PAYMENTS_API_KEY is not set");

  const dodo = new DodoPayments({ bearerToken, environment: "test_mode" });

  const before = await dodo.subscriptions.retrieve(subscriptionId);
  console.log(`subscription      ${before.subscription_id}`);
  console.log(`status            ${before.status}`);
  console.log(`next_billing_date ${before.next_billing_date}`);
  if (before.cancel_at_next_billing_date) console.log("note              cancel_at_next_billing_date is set; this will end it");

  if (before.status !== "active") {
    console.warn(`warning: status is ${before.status}, not active; Dodo may not renew it`);
  }

  // toISOString() always emits the UTC "Z" form Dodo requires.
  const nextBillingDate = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const after = await dodo.subscriptions.update(subscriptionId, { next_billing_date: nextBillingDate });

  console.log(`\nnext_billing_date -> ${after.next_billing_date}`);
  console.log(`Renewal should fire in ~${delaySeconds}s. Watch the dev server logs for billing.webhook.subscription_applied.`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
