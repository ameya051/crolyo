import DodoPayments from "dodopayments";

import type { BillingInterval, BillingMode } from "@/lib/types";

/**
 * Server-only Dodo Payments client. Never import this module from a Client
 * Component: it reads the API and webhook secrets.
 */
let client: DodoPayments | null = null;

/** Anything other than an explicit "live_mode" runs against Dodo test mode. */
export function getBillingMode(): BillingMode {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live" : "test";
}

export function getDodoClient(): DodoPayments {
  if (client) return client;

  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!bearerToken || !webhookKey) {
    throw new Error("Dodo Payments credentials are not configured");
  }

  client = new DodoPayments({
    bearerToken,
    webhookKey,
    environment: getBillingMode() === "live" ? "live_mode" : "test_mode",
  });
  return client;
}

export function getProductId(interval: BillingInterval): string {
  const productId =
    interval === "monthly" ? process.env.DODO_PRODUCT_ID_MONTHLY : process.env.DODO_PRODUCT_ID_ANNUAL;
  if (!productId) {
    throw new Error(`Dodo product for the ${interval} plan is not configured`);
  }
  return productId;
}

export function getIntervalForProduct(productId: string): BillingInterval | null {
  if (productId === process.env.DODO_PRODUCT_ID_MONTHLY) return "monthly";
  if (productId === process.env.DODO_PRODUCT_ID_ANNUAL) return "annual";
  return null;
}
