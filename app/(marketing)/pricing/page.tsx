import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";
import { buttonVariants } from "@/components/ui/button";

// TODO: once dodo-billing merges, import PLANS and PLAN_NAME from @/lib/billing/plans instead.
const PLAN_NAME = "Crolyo";
type BillingInterval = "monthly" | "annual";
const PLANS: Record<BillingInterval, { label: string; price: string; period: string; note?: string }> = {
  monthly: { label: "Monthly", price: "$8", period: "month" },
  annual: { label: "Annual", price: "$80", period: "year", note: "2 months free" },
};

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One simple plan. $8/month or $80/year, with a 14-day free trial and no card required.",
};

const FEATURES = [
  "Unlimited conversations, replied to from Slack",
  "Real-time messages in your Slack channel",
  "Reply from Slack desktop or mobile",
  "One script tag, 2-minute setup",
  "Under 100KB widget, no Lighthouse hit",
  "Native Next.js support",
];

const FAQ = [
  {
    q: "Do I need a card to start the trial?",
    a: "No. Every account gets 14 days of full access for free. You only enter payment details if you decide to subscribe.",
  },
  {
    q: "When am I charged?",
    a: "When you subscribe, you're charged for the first period straight away, then automatically at the start of each month or year until you cancel.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Settings → Billing in your dashboard. You keep access until the end of the period you've paid for and won't be charged again.",
  },
  {
    q: "Do you offer refunds?",
    a: "Because the trial lets you try everything first, payments are non-refundable except for billing errors or where the law requires.",
    link: { href: "/refund", label: "Read the refund policy" },
  },
  {
    q: "Who processes payments?",
    a: "Dodo Payments is our Merchant of Record. They handle checkout, invoices, and any sales tax or VAT for your country.",
  },
];

const INTERVALS: BillingInterval[] = ["monthly", "annual"];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <section className="pt-28 sm:pt-36 pb-12 sm:pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-slack-green animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground tracking-wide">
                14-day free trial &middot; No card required
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
              Simple pricing. One plan.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everything in {PLAN_NAME}, for every site. Pay monthly or save with an annual plan.
            </p>
          </div>
        </section>

        <section className="pb-20 sm:pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 grid gap-6 md:grid-cols-2">
            {INTERVALS.map((interval) => {
              const plan = PLANS[interval];
              const featured = interval === "annual";
              return (
                <div
                  key={interval}
                  className={`relative flex flex-col rounded-2xl border p-8 bg-surface/40 ${
                    featured ? "border-brand shadow-xl" : "border-border/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{plan.label}</h2>
                    {plan.note && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand/10 text-brand">
                        {plan.note}
                      </span>
                    )}
                  </div>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground">/ {plan.period}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Billed {interval === "annual" ? "yearly" : "monthly"}. Cancel any time.
                  </p>
                  <ul className="mt-8 space-y-3 text-sm text-foreground/80 flex-1">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex gap-3">
                        <svg className="w-5 h-5 shrink-0 text-slack-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      variant: featured ? "default" : "outline",
                      className: `mt-8 h-11 w-full text-sm font-medium ${featured ? "bg-brand text-white hover:bg-brand/90" : ""}`,
                    })}
                  >
                    Start 14-day free trial
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground px-4">
            Prices in USD. Applicable taxes are calculated at checkout.
          </p>
        </section>

        <section className="pb-24 sm:pb-32">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">
              Billing questions
            </h2>
            <div className="divide-y divide-border/60 border-y border-border/60">
              {FAQ.map((item) => (
                <div key={item.q} className="py-6">
                  <h3 className="font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-foreground/80 leading-relaxed">
                    {item.a}{" "}
                    {item.link && (
                      <Link href={item.link.href} className="text-brand underline-offset-4 hover:underline">
                        {item.link.label}
                      </Link>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
