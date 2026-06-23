import type { Metadata } from "next";
import { LegalPageLayout } from "@/app/(marketing)/_legal/LegalPageLayout";
import { termsSections, TERMS_EFFECTIVE_DATE } from "./content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules of the road for using Crolyo. Plain-English summary plus the formal terms for site owners.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow={TERMS_EFFECTIVE_DATE}
      title="Terms of Service"
      subtitle="Crolyo is simple by design — and so are these terms. Here's the short version: be a good citizen, don't abuse the service, and we'll do our best to keep the lights on. The full terms follow."
      sections={termsSections}
    />
  );
}
