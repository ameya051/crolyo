# Billing webhook testing (Dodo test mode)

This is an end-to-end runbook for every billing lifecycle path, using real signed Dodo webhooks. The automated tests cover the route's logic with a mocked DB:

- `app/api/webhooks/dodo/route.test.ts`: event handling, signatures and error branches.
- `lib/billing/access.test.ts`: what each resulting row means for access.

This runbook covers what mocks can't: Dodo's real payloads and event order, the `apply_dodo_subscription` ordering SQL, and checkout session bookkeeping.

## Setup (once)

1. Use test-mode keys in `.env.local`, with `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
2. Run `bun dev`, then in another terminal run `ngrok http 3000`. `proxy.ts` already skips auth for `/api/webhooks/`.
3. In the Dodo dashboard (test mode), go to Developer → Webhooks and add an endpoint for `https://<ngrok-host>/api/webhooks/dodo`. Subscribe it to all `subscription.*` and `payment.*` events. Copy its signing secret into `DODO_PAYMENTS_WEBHOOK_KEY` and restart `bun dev`. Every ngrok restart changes the host, so update the endpoint URL each time.
4. Sign up a fresh test user per scenario. Billing state per user is sticky: one live checkout, and one blocking subscription.

### Test cards

Use expiry `06/32` and CVV `123`. The renewal-failure card uses `12/34`.

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Generic decline at checkout |
| `4000 0000 0000 9995` | Insufficient funds at checkout |
| `4000 0000 0000 0341` | Passes at checkout, **declines on the next charge** (renewal / trial end) |

> **Use non-Indian cards (the US ones above) for renewal scenarios 4–9.** Renewals on Indian cards and UPI run on an RBI e-mandate. They stay `processing` for about 48–51 hours after the renewal date, and `subscription.renewed` / `payment.succeeded` (or the failure) only arrive after the debit. Until the charge settles, Dodo rejects a second charge on the same subscription. `billing:advance` still sends `subscription.updated` immediately with the new `next_billing_date`.

### SQL helpers (Supabase SQL editor)

Replace the email with the scenario's test user.

```sql
-- Current state for a user
select u.id, u.trial_ends_at, u.billing_mode, u.dodo_customer_id
from public.users u where u.email = 'you+scenario1@example.com';

select dodo_subscription_id, status, product_id, next_billing_date,
       cancel_at_next_billing_date, cancelled_at, past_due_ends_at,
       last_event_type, last_event_at, updated_at
from public.billing_subscriptions
where user_id = (select id from public.users where email = 'you+scenario1@example.com')
order by created_at desc;

select id, interval, status, dodo_session_id, expires_at, updated_at
from public.billing_checkout_sessions
where user_id = (select id from public.users where email = 'you+scenario1@example.com')
order by created_at desc;

-- End the app-managed trial now (checkout then uses 0 trial days)
update public.users set trial_ends_at = now() - interval '1 minute'
where email = 'you+scenario1@example.com';
```

Each step below lists the log line to look for in the `bun dev` output (JSON lines with an `event` field). The Dodo dashboard's webhook log shows each delivery and its response code.

## Scenarios

### 1. Checkout success (with trial)
1. Settings → Billing → choose monthly → pay with `4242…`.
2. Expect `subscription.active` → log `billing.webhook.subscription_applied`, then `billing.webhook.checkout_completed`.
3. SQL: the sub is `active` with `last_event_type = subscription.active`, and the checkout session is `completed`.
4. UI: the page shows the subscription and the trial days still counting. No charge yet (Dodo → Payments shows nothing).

### 2. Checkout success (no trial left)
1. Fresh user, then **end the app trial** with SQL. Pay with `4242…`.
2. Expect `subscription.active`, and `payment.succeeded` within 2–10 minutes (log `billing.webhook.ignored` for the payment event).
3. SQL: `active`. Dodo → Payments shows the charge.

### 3. Checkout fail
1. Fresh user → start checkout → pay with `4000…0002`. With a trial, the `0341` card also fails here, on the $0 card authorization.
2. Dodo redirects to `/settings/billing?checkout=success&…&status=failed`. Expect a red "Your payment didn't go through" banner and the plan picker. There should be no "Confirming your payment…" spinner.
3. Webhooks, observed on 2026-11-18: `payment.failed` (log `billing.webhook.ignored`), `subscription.failed` (log `billing.webhook.subscription_applied` with status `failed`, then `billing.webhook.checkout_completed`), then `subscription.updated` (status `failed`).
4. SQL: the sub row has status `failed`. The checkout session is `completed`, because Dodo spent that session on the failed subscription and marking it frees the slot.
5. Subscribe again from the banner page with `4000…9995` (fails the same way), then with `4242…` → success. A new checkout session is created (log `billing.checkout.succeeded`).
6. SQL: exactly one `active` sub alongside the `failed` ones, and no `billing.subscription.duplicate_detected` warning.

### 4. First charge after the trial ends
1. Do scenario 1 (trial checkout with `4242…`). Copy the `sub_…` id.
2. `bun run billing:advance <sub_id>`. This moves `next_billing_date`, which is the trial end, to now + 60s.
3. Expect `subscription.updated` right away, then `subscription.renewed` together with `payment.succeeded` once the charge settles. With a US card that takes a minute or two; with an Indian card it takes about 48 hours (see the note under Test cards).
4. SQL: still `active`, `last_event_type = subscription.renewed`, and `next_billing_date` about one interval from now. Dodo → Payments shows the first charge.

### 5. Renewal success
1. On the same sub as scenario 4, run `bun run billing:advance <sub_id>` again.
2. Expect another `subscription.renewed` + `payment.succeeded`.
3. SQL: `next_billing_date` moved forward again, and `last_event_at` is newer.

### 6. Renewal fail (and first-charge fail)

> **Observed on 2026-11-18:** in this Dodo test account, `0341` was declined on *every* charge, including full no-trial checkouts. So it never produced an active subscription to renew. The Dodo API also refuses merchant status changes other than Cancelled (`422 Status can only be updated to Cancelled by the merchant`). What worked was a signed `subscription.on_hold` webhook built from the real subscription object (`dodo.subscriptions.retrieve`, status overridden, HMAC-signed with `DODO_PAYMENTS_WEBHOOK_KEY`) and POSTed to `/api/webhooks/dodo`. That covers signature, route, DB and UI, but not Dodo's own sending. Try the steps below first, in case Dodo fixes the card.

1. Fresh user → **end the app trial with SQL first**, then check out with **`4000 0000 0000 0341`**. Ending the trial first means checkout takes the full charge, which `0341` passes, and the failure later shows up as lost access rather than as `trialing`. A *trial* checkout with `0341` is declined at the $0 authorization (see scenario 3).
2. Confirm the sub is `active`.
3. `bun run billing:advance <sub_id>`.
4. Expect `subscription.on_hold`. If a grace period is configured in Dodo, expect `subscription.past_due` first, then `on_hold` when it ends.
5. SQL: status `on_hold` (or `past_due` with `past_due_ends_at` set).
6. UI: the billing page shows the payment-failed state, and the user's sites stop serving (access `payment_failed`). Starting a new checkout is refused with the payment-failed message, not a second subscription.
7. Variant: skip step 2. The UI should show `trialing`, and access continues until the app trial ends.

### 7. Recovery from on_hold
1. Continue from scenario 6. Billing → manage billing (Dodo portal) → update the payment method to `4242…`.
2. Expect `payment.succeeded`, then `subscription.active`.
3. SQL: back to `active`, and the UI shows subscribed. Sites serve again.
4. If scenario 6 used a signed webhook, Dodo still has the sub `active`. In that case recover by either (a) sending a signed `subscription.active` (the normal path), or (b) running the reconcile cron, which logs `billing.reconcile.drift_corrected` and restores `active` from Dodo (the lost-webhook path). Both passed on 2026-11-18.

### 8. Cancel at period end
1. Active sub (scenario 1) → Dodo portal → cancel.
2. Expect `subscription.updated` (or `subscription.cancelled`, depending on the portal setting) with `cancel_at_next_billing_date = true`.
3. SQL: still `active` with `cancel_at_next_billing_date = true`. UI: still has access and shows the end date.
4. `bun run billing:advance <sub_id>` (the script warns that this ends it).
5. Expect `subscription.cancelled` or `subscription.expired`. SQL: status ends; UI: `expired` (after the app trial). A new checkout is allowed again.

### 9. Plan change (monthly → annual)
1. Active monthly sub → change plan through the Dodo dashboard (Subscriptions → the sub → change plan) or the API (`subscriptions.changePlan`).
2. Expect `subscription.plan_changed` (plus `payment.succeeded` for proration).
3. SQL: `product_id` = `DODO_PRODUCT_ID_ANNUAL`.
4. Variant: the same while on card `0341` → the charge fails → `on_hold`.

### 10. Delivery guarantees
- **Replay old event:** in the Dodo webhook log, resend an *older* `subscription.active` for a sub that has since renewed. Expect log `billing.webhook.subscription_stale` and no change in SQL.
- **Duplicate delivery:** resend the *latest* event. It re-applies the same values (idempotent), and the checkout isn't completed twice.
- **Bad signature:**
  ```sh
  curl -i -X POST http://localhost:3000/api/webhooks/dodo \
    -H "webhook-id: msg_x" -H "webhook-timestamp: $(date +%s)" -H "webhook-signature: v1,bad" \
    -d '{"type":"subscription.active"}'
  ```
  Expect `401` and log `billing.webhook.signature_invalid`.
- **Endpoint down:** stop `bun dev` and trigger scenario 5. Dodo marks the delivery failed and retries. Start the server again and confirm the retry is applied.

### 11. Ordering SQL directly
Run this on a sub from scenario 4. It must return `false` and leave the row unchanged:
```sql
select public.apply_dodo_subscription(
  '<sub_id>', '<user_id>', 'test', '<cus_id>', '<product_id>', 'cancelled',
  null, false, now(), null, 'manual.stale_test', '2000-01-01T00:00:00Z'
);
```

### 12. Reconciliation catches a missed webhook
1. Simulate drift: `update public.billing_subscriptions set status = 'on_hold' where dodo_subscription_id = '<sub_id>';`
2. Run:
   ```sh
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/billing-reconcile
   ```
3. Expect log `billing.reconcile.drift_corrected` listing `status`, and the row back to Dodo's real status.

## Checklist

| # | Scenario | Webhook(s) | Pass |
|---|---|---|---|
| 1 | Checkout success, trial | `subscription.active` | ☐ |
| 2 | Checkout success, no trial | `subscription.active`, `payment.succeeded` | ☐ |
| 3 | Checkout fail + retry | `payment.failed` (`subscription.failed`) | ☐ |
| 4 | First charge after trial | `subscription.renewed`, `payment.succeeded` | ☐ |
| 5 | Renewal success | `subscription.renewed`, `payment.succeeded` | ☐ |
| 6 | Renewal fail | `subscription.on_hold` / `past_due` | ☐ |
| 7 | Recovery | `payment.succeeded`, `subscription.active` | ☐ |
| 8 | Cancel at period end | `subscription.updated` → `cancelled`/`expired` | ☐ |
| 9 | Plan change | `subscription.plan_changed` | ☐ |
| 10 | Replay / duplicate / bad signature / retry | any | ☐ |
| 11 | Ordering SQL | n/a | ☐ |
| 12 | Reconciliation | n/a | ☐ |

After scenarios 1, 4 and 6, compare one real payload in the Dodo webhook log against the fixture in `route.test.ts` (`subscriptionData`). Update the fixture if Dodo's shape differs.
