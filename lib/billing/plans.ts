import type { BillingInterval } from "@/lib/types";

export const PLAN_NAME = "Crolyo";

/**
 * Display copy only. Dodo's checkout is the source of truth for the charged price;
 * keep these in sync with the products configured in the Dodo dashboard.
 */
export const PLANS: Record<BillingInterval, { label: string; price: string; period: string; note?: string }> = {
  monthly: { label: "Monthly", price: "$8", period: "month" },
  annual: { label: "Annual", price: "$80", period: "year", note: "2 months free" },
};
