"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangleIcon, ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AccessState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  info: "border-border bg-muted/60 text-foreground",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

function bannerContent(billing: AccessState): { tone: Tone; text: string; cta: string } | null {
  switch (billing.kind) {
    case "trialing": {
      // A plan bought mid-trial is already shown on the billing page; no nagging.
      if (billing.subscription) return null;
      const days = billing.trialDaysLeft;
      return {
        tone: days <= 3 ? "warning" : "info",
        text: `${days} ${days === 1 ? "day" : "days"} left in your free trial.`,
        cta: "Choose a plan",
      };
    }
    case "past_due":
      return { tone: "warning", text: "We couldn't process your last payment.", cta: "Update payment method" };
    case "payment_failed":
    case "expired":
      return {
        tone: "danger",
        text:
          billing.kind === "expired"
            ? "Your free trial has ended. Your chat widget is offline and Slack replies aren't delivered."
            : "Your payment failed. Your chat widget is offline and Slack replies aren't delivered.",
        cta: billing.kind === "expired" ? "Choose a plan" : "Update payment method",
      };
    default:
      return null;
  }
}

export function BillingBanner({ billing }: { billing: AccessState | null }) {
  const pathname = usePathname();
  if (!billing || pathname === "/settings/billing") return null;

  const content = bannerContent(billing);
  if (!content) return null;

  const Icon = content.tone === "info" ? ClockIcon : AlertTriangleIcon;

  return (
    <div className={cn("border-b", toneClasses[content.tone])}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span>{content.text}</span>
        </p>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/settings/billing" />}>
          {content.cta}
        </Button>
      </div>
    </div>
  );
}
