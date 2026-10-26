import { z } from "zod";

export const checkoutSchema = z.object({
  interval: z.enum(["monthly", "annual"]),
});

/** The subset of a Dodo subscription (webhook `data` or API object) we persist. */
export const dodoSubscriptionSchema = z.object({
  subscription_id: z.string().min(1),
  status: z.string().min(1),
  product_id: z.string().min(1),
  customer: z.object({ customer_id: z.string().min(1) }),
  next_billing_date: z.string().nullish(),
  cancel_at_next_billing_date: z.boolean().nullish(),
  cancelled_at: z.string().nullish(),
  past_due_ends_at: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type DodoSubscriptionSnapshot = z.infer<typeof dodoSubscriptionSchema>;
