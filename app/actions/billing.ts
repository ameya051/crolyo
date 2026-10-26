"use server";

import { redirect } from "next/navigation";

import { findBlockingSubscription, remainingTrialDays } from "@/lib/billing/access";
import { getBillingMode, getDodoClient, getProductId } from "@/lib/billing/dodo";
import { customerIdFor, ensureDodoCustomer, getCurrentBillingAccount } from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validations/billing";

export type BillingActionState = { error?: string };

export async function startCheckout(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  logger.info("billing.checkout.started");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn("billing.checkout.unauthorized");
    return { error: "Unauthorized" };
  }

  const parsed = checkoutSchema.safeParse({ interval: formData.get("interval") });
  if (!parsed.success) {
    logger.warn("billing.checkout.validation_failed");
    return { error: "Choose a plan to continue." };
  }
  const { interval } = parsed.data;

  const account = await getCurrentBillingAccount();
  if (!account) {
    logger.warn("billing.checkout.account_unavailable");
    return { error: "Could not load your billing details. Please try again." };
  }

  const mode = getBillingMode();
  const blocking = findBlockingSubscription(account.billing_subscriptions, mode);
  if (blocking) {
    logger.warn("billing.checkout.blocked", { status: blocking.status });
    return {
      error:
        blocking.status === "on_hold"
          ? "Your last payment failed. Update your payment method from Manage billing."
          : "You already have a Crolyo plan. Manage it from Billing.",
    };
  }

  const trialDays = remainingTrialDays(account.trial_ends_at);
  let checkoutUrl: string;
  try {
    const customerId = await ensureDodoCustomer(account, user, mode);
    const siteUrl = getSiteUrl();
    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: getProductId(interval), quantity: 1 }],
      customer: { customer_id: customerId },
      subscription_data: { trial_period_days: trialDays },
      metadata: { user_id: account.id },
      return_url: `${siteUrl}/api/billing/return`,
      cancel_url: `${siteUrl}/settings/billing`,
    });
    if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL");

    checkoutUrl = session.checkout_url;
    logger.info("billing.checkout.succeeded", { interval, trialDays, mode, sessionId: session.session_id });
  } catch (error) {
    logger.error("billing.checkout.failed", error, { interval, mode });
    return { error: "Could not start checkout. Please try again." };
  }

  redirect(checkoutUrl);
}

export async function openBillingPortal(): Promise<BillingActionState> {
  logger.info("billing.portal.started");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn("billing.portal.unauthorized");
    return { error: "Unauthorized" };
  }

  const mode = getBillingMode();
  const account = await getCurrentBillingAccount();
  const customerId = customerIdFor(account, mode);
  if (!customerId) {
    logger.warn("billing.portal.no_customer", { mode });
    return { error: "You don't have a billing account yet. Choose a plan first." };
  }

  let portalUrl: string;
  try {
    const session = await getDodoClient().customers.customerPortal.create(customerId, {
      return_url: `${getSiteUrl()}/settings/billing`,
    });
    portalUrl = session.link;
    logger.info("billing.portal.succeeded", { mode });
  } catch (error) {
    logger.error("billing.portal.failed", error, { mode });
    return { error: "Could not open billing management. Please try again." };
  }

  redirect(portalUrl);
}
