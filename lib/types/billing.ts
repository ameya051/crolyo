export type BillingMode = "test" | "live"

export type BillingInterval = "monthly" | "annual"

export type BillingCheckoutStatus = "pending" | "open" | "completed" | "expired" | "failed"

export type BillingCheckoutSessionRow = {
  id: string
  user_id: string
  mode: BillingMode
  interval: BillingInterval
  status: BillingCheckoutStatus
  dodo_session_id: string | null
  checkout_url: string | null
  expires_at: string
  created_at: string
}

export type BillingSubscriptionRow = {
  dodo_subscription_id: string
  mode: BillingMode
  product_id: string
  status: string
  next_billing_date: string | null
  cancel_at_next_billing_date: boolean
  past_due_ends_at: string | null
  created_at: string
}

export type BillingAccessRow = {
  trial_ends_at: string
  billing_subscriptions: BillingSubscriptionRow[] | null
}

/** `owner:users!inner(...)` embedded on a sites row. */
export type OwnerBillingEmbed = BillingAccessRow | BillingAccessRow[] | null

export type BillingAccountRow = BillingAccessRow & {
  id: string
  /** Mode `dodo_customer_id` was created in; both are null until the first checkout. */
  billing_mode: BillingMode | null
  dodo_customer_id: string | null
}

export type AccessKind = "subscribed" | "past_due" | "trialing" | "payment_failed" | "expired"

export type AccessState = {
  kind: AccessKind
  hasAccess: boolean
  trialEndsAt: string | null
  trialDaysLeft: number
  subscription: BillingSubscriptionRow | null
  hasDuplicateSubscriptions: boolean
}
