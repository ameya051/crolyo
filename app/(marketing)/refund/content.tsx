import type { ReactNode } from "react";
import type { LegalSection } from "@/app/(marketing)/_legal/LegalPageLayout";
import { CONTACT_EMAIL } from "@/app/(marketing)/_legal/contact";

const EFFECTIVE_DATE = "Last updated: November 1, 2026";

const Para = ({ children }: { children: ReactNode }) => <p>{children}</p>;

export const refundSections: LegalSection[] = [
  {
    id: "free-trial",
    title: "Free Trial",
    content: (
      <>
        <Para>
          Every new Crolyo account starts with a 14-day free trial with full
          access to the Service. No payment details are needed to start, and
          you are never charged during the trial. The trial is your window to
          decide whether Crolyo is right for you before paying anything.
        </Para>
        <Para>
          When the trial ends, the widget stops relaying messages until you
          subscribe. Nothing is charged automatically.
        </Para>
      </>
    ),
  },
  {
    id: "cancellation",
    title: "Cancellation",
    content: (
      <>
        <Para>
          You can cancel your subscription at any time from{" "}
          <strong>Settings &rarr; Billing</strong> in your Crolyo dashboard.
          No email or call is required.
        </Para>
        <Para>
          Cancellation takes effect at the end of your current billing
          period. You keep full access until then, and you will not be
          charged again. You can resume your subscription before the period
          ends if you change your mind.
        </Para>
      </>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    content: (
      <>
        <Para>
          Because every account gets a free trial before any payment, all
          subscription payments are non-refundable. We do not provide refunds
          or credits for partial billing periods, unused time, or for
          cancelling partway through a monthly or annual period.
        </Para>
        <Para>We will always refund:</Para>
        <ul>
          <li>Duplicate charges for the same billing period.</li>
          <li>Charges made in error due to a fault on our side.</li>
          <li>Any refund required by applicable consumer-protection law.</li>
        </ul>
        <Para>
          Approved refunds are issued to the original payment method through
          Dodo Payments and typically arrive within 5&ndash;10 business days,
          depending on your bank.
        </Para>
      </>
    ),
  },
  {
    id: "failed-payments",
    title: "Failed Payments",
    content: (
      <Para>
        If a renewal payment fails, your subscription enters a short grace
        period while the payment is retried, and you keep access during that
        time. You can update your payment method from your billing settings.
        If the payment still cannot be collected, access is paused until the
        subscription is renewed.
      </Para>
    ),
  },
  {
    id: "merchant-of-record",
    title: "Merchant of Record",
    content: (
      <Para>
        Payments for Crolyo are processed by Dodo Payments, which acts as our
        Merchant of Record. Dodo Payments handles checkout, invoicing, and
        applicable taxes, and your charge may appear on your statement under
        Dodo Payments.
      </Para>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <Para>
        Questions about a charge, or think you were billed in error? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your
        account email and we&apos;ll get back to you within 2 business days.
      </Para>
    ),
  },
];

export { EFFECTIVE_DATE as REFUND_EFFECTIVE_DATE };
