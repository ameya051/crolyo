import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/route-guard";
import { createOrReuseCheckout } from "@/lib/billing/checkout";
import { getBillingMode } from "@/lib/billing/dodo";
import { getCurrentBillingAccount } from "@/lib/billing/server";
import { logger } from "@/lib/logger";
import { checkoutSchema } from "@/lib/validations/billing";

export async function POST(request: Request) {
  logger.info("billing.checkout.started");
  const auth = await requireUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("billing.checkout.validation_failed");
    return NextResponse.json({ error: "Choose a plan to continue." }, { status: 400 });
  }
  const { interval } = parsed.data;

  const account = await getCurrentBillingAccount();
  if (!account) {
    logger.warn("billing.checkout.account_unavailable");
    return NextResponse.json(
      { error: "Could not load your billing details. Please try again." },
      { status: 500 }
    );
  }

  const mode = getBillingMode();
  try {
    const result = await createOrReuseCheckout({ account, user: auth.user, interval, mode });
    switch (result.kind) {
      case "ready":
        return NextResponse.json({ checkoutUrl: result.checkoutUrl, resumed: result.resumed });
      case "subscription_exists":
        return NextResponse.json(
          { error: "You already have a Crolyo plan. Manage it from Billing.", code: result.kind },
          { status: 409 }
        );
      case "payment_failed":
        return NextResponse.json(
          { error: "Your last payment failed. Update your payment method from Manage billing.", code: result.kind },
          { status: 409 }
        );
      case "checkout_open":
        return NextResponse.json(
          {
            error: `You already have a ${result.interval} checkout open.`,
            code: result.kind,
            interval: result.interval,
            checkoutUrl: result.checkoutUrl,
          },
          { status: 409 }
        );
      case "checkout_in_progress":
        return NextResponse.json(
          { error: "Your checkout is being prepared. Try again in a moment.", code: result.kind },
          { status: 409 }
        );
    }
  } catch (error) {
    logger.error("billing.checkout.failed", error, { interval, mode });
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
