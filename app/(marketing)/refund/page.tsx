import type { Metadata } from "next";
import { LegalPageLayout } from "@/app/(marketing)/_legal/LegalPageLayout";
import { refundSections, REFUND_EFFECTIVE_DATE } from "./content";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "How Crolyo's free trial, cancellations, and refunds work.",
};

export default function RefundPage() {
  return (
    <LegalPageLayout
      eyebrow={REFUND_EFFECTIVE_DATE}
      title="Refund & Cancellation Policy"
      subtitle="Try Crolyo free for 14 days, cancel any time in two clicks, and keep access until the end of the period you've paid for."
      sections={refundSections}
    />
  );
}
