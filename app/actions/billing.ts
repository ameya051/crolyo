"use server";

import { redirect } from "next/navigation";

import { getBillingMode, getDodoClient } from "@/lib/billing/dodo";
import { customerIdFor, getCurrentBillingAccount } from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type BillingActionState = { error?: string };
const SITE_URL = getSiteUrl();

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
      return_url: `${SITE_URL}/settings/billing`,
    });
    portalUrl = session.link;
    logger.info("billing.portal.succeeded", { mode });
  } catch (error) {
    logger.error("billing.portal.failed", error, { mode });
    return { error: "Could not open billing management. Please try again." };
  }

  redirect(portalUrl);
}
