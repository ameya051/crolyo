import type { Metadata } from "next";
import { LegalPageLayout } from "@/app/(marketing)/_legal/LegalPageLayout";
import { privacySections, PRIVACY_EFFECTIVE_DATE } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Crolyo collects, uses, and protects your data. A plain-English summary of our privacy practices for site owners and their visitors.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      eyebrow={PRIVACY_EFFECTIVE_DATE}
      title="Privacy Policy"
      subtitle="We built Crolyo to be lightweight — and our privacy stance matches: we collect what we need to deliver the chat widget, and nothing more. Here's exactly what that looks like."
      sections={privacySections}
    />
  );
}
