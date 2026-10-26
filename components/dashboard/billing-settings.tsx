"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { openBillingPortal, startCheckout, type BillingActionState } from "@/app/actions/billing";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { PLAN_NAME, PLANS } from "@/lib/billing/plans";
import type { AccessKind, BillingInterval } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface BillingView {
  kind: AccessKind;
  trialDaysLeft: number;
  trialEndsOn: string | null;
  subscription: {
    status: string;
    interval: BillingInterval | null;
    nextBillingOn: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  hasCustomer: boolean;
  hasDuplicateSubscriptions: boolean;
  testMode: boolean;
  checkoutReturned: boolean;
}

const initialState: BillingActionState = {};
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

function useActionErrorToast(state: BillingActionState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
}

function StatusSummary({ view }: { view: BillingView }) {
  const { subscription } = view;
  const plan = subscription?.interval ? PLANS[subscription.interval] : null;
  const planName = plan ? `${PLAN_NAME} ${plan.label}` : PLAN_NAME;

  switch (view.kind) {
    case "subscribed": {
      let detail: string;
      if (subscription?.cancelAtPeriodEnd) {
        detail = `Your plan ends on ${subscription.nextBillingOn}. You won't be charged again, and chat stays online until then.`;
      } else if (view.trialDaysLeft > 0) {
        detail = `Free until ${subscription?.nextBillingOn}, then ${plan ? `${plan.price}/${plan.period}` : "your plan price"}.`;
      } else {
        detail = `Renews on ${subscription?.nextBillingOn}${plan ? ` for ${plan.price}` : ""}.`;
      }
      return (
        <SummaryCard title={planName} badge={<StatusBadge tone="success" dot>Active</StatusBadge>} detail={detail} />
      );
    }
    case "past_due":
      return (
        <SummaryCard
          title={planName}
          badge={<StatusBadge tone="warning" dot>Payment overdue</StatusBadge>}
          detail="We couldn't charge your card. Update your payment method to keep your chat widget online."
        />
      );
    case "trialing":
      return (
        <SummaryCard
          title="Free trial"
          badge={<StatusBadge tone="brand">{view.trialDaysLeft} {view.trialDaysLeft === 1 ? "day" : "days"} left</StatusBadge>}
          detail={
            subscription
              ? "There's a problem with your plan's payment. Update it from Manage billing before your trial ends."
              : `Your trial ends on ${view.trialEndsOn}. Choose a plan to keep your chat widget online.`
          }
        />
      );
    case "payment_failed":
      return (
        <SummaryCard
          title={planName}
          badge={<StatusBadge tone="warning" dot>Payment failed</StatusBadge>}
          detail="Your chat widget is offline and Slack replies aren't delivered. Update your payment method to restore it."
        />
      );
    case "expired":
      return (
        <SummaryCard
          title="No active plan"
          badge={<StatusBadge tone="muted">Inactive</StatusBadge>}
          detail={`Your free trial ended${view.trialEndsOn ? ` on ${view.trialEndsOn}` : ""}. Your chat widget is offline and Slack replies aren't delivered until you choose a plan.`}
        />
      );
  }
}

function SummaryCard({ title, badge, detail }: { title: string; badge: React.ReactNode; detail: string }) {
  return (
    <section className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {badge}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </section>
  );
}

function PlanPicker({ view }: { view: BillingView }) {
  const [interval, setSelectedInterval] = useState<BillingInterval>("monthly");
  const [state, formAction, pending] = useActionState(startCheckout, initialState);
  useActionErrorToast(state);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Choose a plan</h2>
        <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label="Billing interval">
          {(Object.keys(PLANS) as BillingInterval[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={interval === key}
              onClick={() => setSelectedInterval(key)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                interval === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PLANS[key].label}
            </button>
          ))}
        </div>
      </div>

      <form action={formAction} className="rounded-xl border p-5">
        <input type="hidden" name="interval" value={interval} />
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-3xl font-bold tracking-tight text-foreground">{PLANS[interval].price}</span>
          <span className="text-sm text-muted-foreground">/ {PLANS[interval].period}</span>
          {PLANS[interval].note ? <StatusBadge tone="success">{PLANS[interval].note}</StatusBadge> : null}
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {["Unlimited sites", "Live chat widget on your websites", "Replies straight from Slack"].map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckIcon className="size-4 text-primary" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {view.kind === "trialing"
              ? `You won't be charged until your trial ends on ${view.trialEndsOn}.`
              : "You'll be charged today. Cancel anytime."}
          </p>
          <Button type="submit" className="h-9 px-4" disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            {pending ? "Opening checkout…" : `Subscribe ${PLANS[interval].label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ManageBilling() {
  const [state, formAction, pending] = useActionState(openBillingPortal, initialState);
  useActionErrorToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">Payment details</p>
        <p className="text-xs text-muted-foreground">Update your card, download invoices, or cancel your plan.</p>
      </div>
      <Button type="submit" variant="outline" className="h-9 px-4" disabled={pending}>
        {pending ? "Opening…" : "Manage billing"}
      </Button>
    </form>
  );
}

/** After checkout, refresh until the subscription shows up (sync or webhook). */
function useCheckoutPolling(active: boolean) {
  const router = useRouter();
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!active || polls >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setPolls((count) => count + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [active, polls, router]);

  return { exhausted: polls >= MAX_POLLS };
}

export function BillingSettings({ view }: { view: BillingView }) {
  const awaitingCheckout = view.checkoutReturned && view.kind !== "subscribed" && view.kind !== "past_due";
  const { exhausted } = useCheckoutPolling(awaitingCheckout);
  const canSubscribe = (view.kind === "trialing" && !view.subscription) || view.kind === "expired";

  return (
    <div className="space-y-8">
      {view.testMode ? (
        <StatusBadge tone="warning" dot>
          Test mode: no real charges
        </StatusBadge>
      ) : null}

      {awaitingCheckout ? (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          {exhausted ? null : <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {exhausted
            ? "We're still confirming your payment. Refresh this page in a minute."
            : "Confirming your payment…"}
        </div>
      ) : null}

      {view.hasDuplicateSubscriptions ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          You have more than one active subscription. Contact support and we&apos;ll refund the duplicate.
        </div>
      ) : null}

      <StatusSummary view={view} />

      {canSubscribe && !awaitingCheckout ? <PlanPicker view={view} /> : null}

      {view.hasCustomer ? <ManageBilling /> : null}
    </div>
  );
}
