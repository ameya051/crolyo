import type { ReactNode } from "react";
import type { LegalSection } from "@/app/(marketing)/_legal/LegalPageLayout";

const EFFECTIVE_DATE = "Last updated: June 23, 2026";
const CONTACT_EMAIL = "support@crolyo.com"; // TODO: replace with the real contact email

const Para = ({ children }: { children: ReactNode }) => <p>{children}</p>;

export const termsSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    content: (
      <>
        <Para>
          By using Crolyo, you agree to these terms. If you don&apos;t agree,
          please don&apos;t use the Service.
        </Para>
        <Para>
          These Terms of Service (the &ldquo;Terms&rdquo;) form a binding
          agreement between you and Crolyo (&ldquo;Crolyo&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). They
          govern your access to and use of our website, dashboard, embeddable
          chat widget, and related services (collectively, the
          &ldquo;Service&rdquo;). By creating an account, installing the
          widget, or otherwise using the Service, you confirm that you accept
          these Terms and our Privacy Policy, and that you have the authority
          to bind the organization you represent (if any).
        </Para>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility",
    content: (
      <>
        <Para>
          You must be of legal age and not barred from using the Service. If
          you&apos;re signing up on behalf of a company, you represent that
          you have authority to bind it.
        </Para>
        <Para>
          You must be at least 18 years old (or the age of legal majority in
          your jurisdiction) and have the legal capacity to enter into a
          binding contract. You may not use the Service if you are barred
          from doing so under any applicable law, including export-control or
          sanctions regulations.
        </Para>
      </>
    ),
  },
  {
    id: "account",
    title: "Your Account",
    content: (
      <>
        <Para>
          Keep your login safe &mdash; you&apos;re responsible for activity
          under your account.
        </Para>
        <Para>
          When you create an account, you agree to provide accurate
          information and keep it up to date. You are responsible for
          safeguarding your account credentials and for any activity that
          occurs under your account, whether or not you authorized it. Notify
          us immediately at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you
          suspect any unauthorized access to your account.
        </Para>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    content: (
      <>
        <Para>Don&apos;t do bad stuff. In particular, you agree not to:</Para>
        <ul>
          <li>
            Use the Service to send spam, phishing messages, or any form of
            unsolicited bulk communication.
          </li>
          <li>
            Use the Service to transmit content that is unlawful, infringing,
            defamatory, obscene, harassing, hateful, or otherwise harmful.
          </li>
          <li>
            Reverse-engineer, decompile, or otherwise attempt to extract the
            source code of the Service, except to the extent this restriction
            is prohibited by applicable law.
          </li>
          <li>
            Interfere with, disrupt, or attempt to gain unauthorized access to
            the Service, its infrastructure, or any related systems.
          </li>
          <li>
            Use the Service in a manner that violates Slack&apos;s own terms
            of service or acceptable-use policies, including by routing
            messages to channels or workspaces you are not authorized to use.
          </li>
          <li>
            Embed the Crolyo widget on a domain not listed in your
            <code> allowed_domains</code> configuration.
          </li>
          <li>
            Use the Service to build a competing product or to train machine
            learning models on data derived from the Service without our
            written consent.
          </li>
        </ul>
        <Para>
          We may suspend or terminate your access if we reasonably believe you
          are violating this section.
        </Para>
      </>
    ),
  },
  {
    id: "the-service",
    title: "The Service",
    content: (
      <>
        <Para>
          Crolyo provides a chat widget you embed on your site, plus a
          dashboard for managing widget configuration and a Slack integration
          that routes visitor messages to a channel of your choice.
        </Para>
        <Para>
          The current minimum-viable scope of the Service is text messaging
          only; file uploads, voice, and video are not supported. We may add,
          change, or remove features over time, and we&apos;ll do our best to
          give you reasonable notice of material changes. We do not guarantee
          that the Service will be uninterrupted, error-free, or free from
          data loss; we work to keep it reliable, but outages happen.
        </Para>
        <Para>
          You&apos;re responsible for what your visitors say in chat and for
          making sure your use of the Service (including any chat content you
          store) complies with laws that apply to you, such as laws governing
          marketing, data protection, and electronic communications.
        </Para>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees and Billing",
    content: (
      <>
        <Para>
          It&apos;s free during the MVP &mdash; we&apos;ll let you know well
          in advance before anything changes.
        </Para>
        <Para>
          During the minimum-viable-product period, Crolyo is provided free
          of charge. We may, at some point in the future, introduce paid
          plans, usage-based pricing, or other commercial terms. We will give
          you reasonable advance notice of any change to pricing, and any new
          fees will not apply to you until you affirmatively opt in (for
          example, by upgrading to a paid plan or by continuing to use a
          feature that has become paid after the notice period).
        </Para>
        <Para>
          Unless required by law, fees are non-refundable. We may update
          pricing for paid plans on reasonable notice, and you may cancel
          before the change takes effect.
        </Para>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    content: (
      <>
        <Para>
          We own Crolyo; you own your content. Each side grants the other a
          limited license to do what&apos;s needed to run the Service.
        </Para>
        <Para>
          <strong>Our stuff.</strong> Crolyo (and our licensors) own all
          right, title, and interest in and to the Service, including the
          widget, dashboard, brand, and underlying technology. We grant you a
          limited, non-exclusive, non-transferable, revocable license to use
          the Service in accordance with these Terms.
        </Para>
        <Para>
          <strong>Your stuff.</strong> You retain ownership of the content
          you submit through the Service, including chat messages, widget
          configuration, and your Slack workspace data. You grant us a
          limited, worldwide, non-exclusive license to use that content
          solely to operate and improve the Service for you.
        </Para>
        <Para>
          <strong>Feedback.</strong> If you send us feedback or suggestions,
          we may use them without restriction or compensation to you.
        </Para>
      </>
    ),
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    content: (
      <>
        <Para>
          We rely on Slack, Supabase, and Vercel &mdash; their terms apply
          too, and their availability affects ours.
        </Para>
        <Para>
          The Service depends on third-party platforms, including Slack,
          Supabase, and Vercel. Your use of those platforms is governed by
          their own terms and privacy policies. We do not control and are not
          responsible for the operation, availability, or security of these
          third-party services. If a third-party service suspends, limits, or
          changes its offering in a way that affects the Service, we will
          work to minimize the impact on you, but we may need to adjust or
          suspend affected features.
        </Para>
      </>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    content: (
      <>
        <Para>
          You can leave anytime; we can too. We&apos;ll keep your data for a
          short window, then it&apos;s gone.
        </Para>
        <Para>
          You may stop using the Service and delete your account at any time
          from the dashboard. We may suspend or terminate your access if you
          breach these Terms, if your continued use creates a security or
          legal risk, or if we discontinue the Service. Where reasonable, we
          will give you advance notice of termination.
        </Para>
        <Para>
          On termination, we will delete or anonymize your personal data
          within a reasonable period, except where retention is required by
          law or for legitimate business records. Chat content associated
          with your sites is deleted along with the site configuration.
        </Para>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <>
        <Para>
          We try our best, but use the Service at your own risk. It&apos;s
          provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
        </Para>
        <Para>
          To the maximum extent permitted by law, the Service is provided
          &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE,&rdquo; without
          warranties of any kind, express or implied, including but not
          limited to implied warranties of merchantability, fitness for a
          particular purpose, non-infringement, and accuracy. Without
          limiting the foregoing, we do not warrant that the Service will be
          uninterrupted, secure, or free of harmful components, or that
          defects will be corrected.
        </Para>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    content: (
      <>
        <Para>
          If something goes wrong, our liability is limited to what
          you&apos;ve paid us in the prior 12 months &mdash; and during the
          MVP, that&apos;s zero.
        </Para>
        <Para>
          To the maximum extent permitted by law, in no event will Crolyo, its
          affiliates, officers, directors, employees, agents, or licensors be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, including lost profits, lost revenue, lost data,
          business interruption, or goodwill, arising out of or related to
          your use of (or inability to use) the Service, regardless of the
          legal theory and even if we have been advised of the possibility of
          such damages.
        </Para>
        <Para>
          Our aggregate liability for any claim arising out of or relating
          to the Service will not exceed the greater of (a) the amounts you
          paid us for the Service in the 12 months preceding the event
          giving rise to the claim, or (b) one hundred US dollars (US$100).
          Because the Service is free during the MVP, our aggregate liability
          is capped at US$100.
        </Para>
      </>
    ),
  },
  {
    id: "indemnification",
    title: "Indemnification",
    content: (
      <>
        <Para>
          If your use of Crolyo gets us sued, you&apos;ll cover our
          reasonable costs &mdash; provided we let you defend it where it
          makes sense.
        </Para>
        <Para>
          You agree to indemnify, defend, and hold Crolyo and its affiliates,
          officers, directors, employees, and agents harmless from and
          against any claims, liabilities, damages, judgments, awards,
          losses, costs, expenses, or fees (including reasonable
          attorneys&apos; fees) arising out of or related to (a) your
          violation of these Terms, (b) your use of the Service, including
          the content you submit and how you configure the widget, or (c)
          your violation of any applicable law or third-party right.
        </Para>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law",
    content: (
      <>
        <Para>
          These terms follow the laws of a single jurisdiction, and disputes
          are resolved in its courts. {/* TODO: confirm and update the
          governing-law jurisdiction and venue before launch. */}
        </Para>
        <Para>
          These Terms, and any dispute or claim arising out of or in
          connection with them, are governed by and construed in accordance
          with the laws of the jurisdiction in which Crolyo is incorporated,
          without regard to its conflict-of-law principles. You and Crolyo
          agree to submit to the exclusive jurisdiction of the courts located
          in that jurisdiction for the resolution of any dispute.
        </Para>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    content: (
      <>
        <Para>
          We may update these Terms as the Service evolves. Material changes
          get reasonable notice; continued use means you&apos;re okay with
          them.
        </Para>
        <Para>
          We may revise these Terms from time to time. If a change is
          material, we will give you reasonable notice (for example, by
          emailing account holders or posting a prominent notice in the
          dashboard) before the change takes effect. The &ldquo;Last
          updated&rdquo; date at the top of this page reflects the current
          version. By continuing to use the Service after the effective
          date of the updated Terms, you agree to be bound by them.
        </Para>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <>
        <Para>
          Questions about these Terms? Reach out to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and
          we&apos;ll get back to you.
        </Para>
        {/* TODO: replace with the legal entity name and registered address
            for formal notices. */}
      </>
    ),
  },
];

export { EFFECTIVE_DATE as TERMS_EFFECTIVE_DATE };
