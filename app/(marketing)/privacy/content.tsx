import type { LegalSection } from "@/app/(marketing)/_legal/LegalPageLayout";

const EFFECTIVE_DATE = "Last updated: June 23, 2026";
const CONTACT_EMAIL = "support@crolyo.com"; // TODO: replace with the real contact email

export const privacySections: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    content: (
      <>
        <p>
          We built Crolyo to be lightweight — and our privacy stance matches:
          we collect what we need to deliver the chat widget, and nothing more.
        </p>
        <p>
          This Privacy Policy explains how Crolyo (&ldquo;Crolyo&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects,
          uses, discloses, and protects information in connection with your use
          of our website, dashboard, and embeddable chat widget (collectively,
          the &ldquo;Service&rdquo;). By accessing or using the Service, you
          agree to the terms of this Privacy Policy.
        </p>
        <p>
          <strong>Data controller.</strong> For the purpose of applicable data
          protection laws, Crolyo is the data controller of personal data
          collected through the Service. {/* TODO: replace with the legal entity name
          and registered address */}
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    content: (
      <>
        <p>
          Here&apos;s exactly what we touch and why — split into two groups:
          what you give us as a site owner, and what we receive from visitors
          who use the chat widget on your site.
        </p>
        <p>
          <strong>From site owners (you):</strong>
        </p>
        <ul>
          <li>
            <strong>Account information.</strong> When you sign in, we receive
            your email address and any name or avatar provided by your
            authentication provider (currently magic-link email and Supabase
            Auth).
          </li>
          <li>
            <strong>Workspace configuration.</strong> The name you give each
            site, your Slack workspace ID, the encrypted Slack bot token, the
            Slack channel ID where chats are routed, the widget&apos;s primary
            color and welcome message, and the list of allowed domains that may
            embed the widget.
          </li>
          <li>
            <strong>Support correspondence.</strong> Anything you send us when
            you contact support.
          </li>
        </ul>
        <p>
          <strong>From visitors (your end users):</strong>
        </p>
        <ul>
          <li>
            <strong>Chat content.</strong> The text messages a visitor sends
            through the widget on your site, plus the message timestamps and a
            persistent visitor identifier (an anonymous cookie or
            browser-fingerprint ID) that ties their messages into a single
            conversation.
          </li>
          <li>
            <strong>Slack thread reference.</strong> The Slack thread timestamp
            (&ldquo;thread_ts&rdquo;) for the visitor&apos;s conversation, used
            to route agent replies back to the right visitor in real time.
          </li>
        </ul>
        <p>
          We do not intentionally collect special categories of personal data
          (such as government identifiers, financial information, or health
          data) through the widget. If a visitor types sensitive information
          into a chat message, that information is stored as ordinary message
          content.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    content: (
      <>
        <p>
          We use the information we collect for one reason: to deliver the
          Service. Specifically, we use it to:
        </p>
        <ul>
          <li>Authenticate you and operate your Crolyo dashboard.</li>
          <li>
            Forward visitor messages from your embedded widget to the
            configured Slack channel.
          </li>
          <li>
            Receive agent replies from Slack and deliver them back to the
            right visitor in real time via Supabase Realtime.
          </li>
          <li>
            Enforce the allowed-domains list you configure, to prevent
            unauthorized sites from embedding your widget.
          </li>
          <li>Detect, prevent, and respond to abuse, security incidents, and fraud.</li>
          <li>
            Communicate with you about the Service, including security and
            policy notices.
          </li>
        </ul>
        <p>
          We do not sell personal data, and we do not use visitor chat content
          to train machine-learning models.
        </p>
      </>
    ),
  },
  {
    id: "data-storage-security",
    title: "Data Storage and Security",
    content: (
      <>
        <p>
          Your bot tokens are encrypted, webhook requests are signed, and your
          domains are whitelisted. We treat these as table stakes, not extras.
        </p>
        <p>
          <strong>Where your data lives.</strong> Persistent data is stored in
          a managed PostgreSQL database provided by Supabase. The application
          runs on Vercel&apos;s hosting platform; static assets (including the
          embeddable widget at <code>/widget.js</code>) are served from
          Vercel&apos;s edge CDN. Slack bot tokens, conversation records, and
          message bodies are stored in the Supabase database.
        </p>
        <p>
          <strong>Encryption.</strong> Slack bot tokens are encrypted at rest
          in the database. Data is transmitted over HTTPS/TLS between your
          browser, our application, Supabase, and Slack.
        </p>
        <p>
          <strong>Slack signature verification.</strong> Every request Slack
          sends to our webhook endpoint at <code>/slack/events</code> is
          verified against the <code>X-Slack-Signature</code> header using
          Slack&apos;s signing secret. Requests that fail verification are
          rejected.
        </p>
        <p>
          <strong>Domain allow-list.</strong> Widget configuration and
          conversation creation requests are checked against the
          <code> allowed_domains</code> list you set for each site. Requests
          originating from domains not on the list are refused.
        </p>
        <p>
          <strong>No system is perfectly secure.</strong> We work hard to
          protect your data, but we cannot guarantee absolute security. If we
          become aware of a security incident affecting your personal data, we
          will notify you in accordance with applicable law.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    content: (
      <>
        <p>
          We lean on a small handful of trusted vendors to run the Service.
          Each one processes data on our behalf under their own terms and
          privacy practices.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> &mdash; PostgreSQL hosting, auth, and
            real-time WebSocket delivery. Supabase acts as a sub-processor for
            data you store in your Crolyo workspace.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; application hosting and edge CDN
            for the embeddable widget.
          </li>
          <li>
            <strong>Slack</strong> &mdash; delivery of visitor messages to your
            channel and receipt of agent replies via the Slack Events API and
            Web API. Slack processes conversation content as a sub-processor
            and on its own terms.
          </li>
        </ul>
        <p>
          Where required, we enter into data-processing agreements with our
          sub-processors to ensure your data is handled consistently with this
          Privacy Policy.
        </p>
      </>
    ),
  },
  {
    id: "cookies-tracking",
    title: "Cookies and Tracking",
    content: (
      <>
        <p>
          We don&apos;t track visitors across the web. The widget sets a single
          first-party cookie (or browser-storage fallback) to remember the
          visitor&apos;s session ID, so their messages stay in the same
          conversation. We don&apos;t use third-party analytics on the
          widget, and we don&apos;t place advertising cookies.
        </p>
        <p>
          On the Crolyo dashboard, we may use privacy-respecting analytics to
          understand aggregate product usage. We do not use those analytics to
          identify individual visitors to your site.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your Rights",
    content: (
      <>
        <p>
          You can access, export, or delete your data anytime &mdash; just ask.
          Depending on where you live, you may also have additional rights
          under applicable law.
        </p>
        <ul>
          <li>
            <strong>Access.</strong> Request a copy of the personal data we
            hold about you.
          </li>
          <li>
            <strong>Correction.</strong> Ask us to correct inaccurate or
            incomplete data.
          </li>
          <li>
            <strong>Deletion.</strong> Ask us to delete your personal data,
            subject to our legal record-keeping obligations.
          </li>
          <li>
            <strong>Export.</strong> Receive your data in a portable,
            machine-readable format.
          </li>
          <li>
            <strong>Objection and restriction.</strong> Object to, or request
            that we restrict, certain processing of your personal data.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will
          respond within the timeframes required by applicable law.
        </p>
      </>
    ),
  },
  {
    id: "childrens-privacy",
    title: "Children's Privacy",
    content: (
      <>
        <p>
          Crolyo isn&apos;t for kids. The Service is not directed to children
          under the age of 13 (or such higher age as required by local law),
          and we do not knowingly collect personal data from children. If you
          believe a child has provided us with personal data, please contact
          us and we will take steps to delete the information.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: (
      <>
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will revise the &ldquo;Last updated&rdquo; date at the top of this
          page. If the changes are material, we will give you reasonable
          notice &mdash; for example, by emailing account holders or posting a
          prominent notice in the dashboard &mdash; before the changes take
          effect.
        </p>
        <p>
          Your continued use of the Service after the effective date of the
          updated Policy constitutes acceptance of the changes.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <>
        <p>
          Questions? Just ask. The fastest way to reach us is by email at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        {/* TODO: replace with the legal entity name, registered address, and
            any data-protection officer contact required by applicable law. */}
      </>
    ),
  },
];

export { EFFECTIVE_DATE as PRIVACY_EFFECTIVE_DATE };
