import type { Metadata } from "next";

import { BillingSettings, type BillingView } from "@/components/dashboard/billing-settings";
import { getAccessState } from "@/lib/billing/access";
import { getBillingMode, getIntervalForProduct } from "@/lib/billing/dodo";
import { customerIdFor, getCurrentBillingAccount } from "@/lib/billing/server";

export const metadata: Metadata = {
  title: "Billing",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDate(value: string | null | undefined): string | null {
  return value ? dateFormat.format(new Date(value)) : null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const account = await getCurrentBillingAccount();
  const mode = getBillingMode();

  if (!account) {
    return (
      <div className="rounded-xl border p-6">
        <h1 className="font-heading text-xl font-bold">Couldn&apos;t load billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Refresh the page in a moment. If this keeps happening, contact support.</p>
      </div>
    );
  }

  const state = getAccessState(account, mode);
  const subscription = state.subscription;
  // Dates are formatted here so the client never renders a timezone-dependent value.
  const view: BillingView = {
    kind: state.kind,
    trialDaysLeft: state.trialDaysLeft,
    trialEndsOn: formatDate(state.trialEndsAt),
    subscription: subscription
      ? {
          status: subscription.status,
          interval: getIntervalForProduct(subscription.product_id),
          nextBillingOn: formatDate(subscription.next_billing_date),
          cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
        }
      : null,
    hasCustomer: customerIdFor(account, mode) !== null,
    hasDuplicateSubscriptions: state.hasDuplicateSubscriptions,
    testMode: mode === "test",
    checkoutReturned: checkout === "success",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your Crolyo plan and payment details.</p>
      </div>
      <BillingSettings view={view} />
    </div>
  );
}
