import { NextResponse } from "next/server";

import { getBillingMode } from "@/lib/billing/dodo";
import { customerIdFor, getCurrentBillingAccount, syncCustomerSubscriptions } from "@/lib/billing/server";
import { requireUser } from "@/lib/auth/route-guard";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Dodo's checkout return_url. Syncs the customer's subscriptions straight from
 * Dodo so the billing page is accurate even before the webhook lands.
 * Never log the request URL: Dodo appends the customer's email to it.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.user) return auth.redirect;

  const mode = getBillingMode();
  const account = await getCurrentBillingAccount();
  const customerId = customerIdFor(account, mode);

  if (account && customerId) {
    try {
      const applied = await syncCustomerSubscriptions(account.id, customerId, mode);
      logger.info("billing.return.synced", { mode, applied });
    } catch (error) {
      logger.error("billing.return.sync_failed", error, { mode });
    }
  } else {
    logger.warn("billing.return.no_customer", { mode });
  }

  return NextResponse.redirect(`${getSiteUrl()}/settings/billing?checkout=success`);
}
