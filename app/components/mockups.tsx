import type { ReactNode } from "react";

/* Static product mockups for the marketing pages: flat, 1px borders, no glow. */

export function SlackIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.527 2.527 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.27a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full border border-border bg-muted" />
      <span className="size-2.5 rounded-full border border-border bg-muted" />
      <span className="size-2.5 rounded-full border border-border bg-muted" />
    </div>
  );
}

/** Neutral app window: title bar with three dots, then content. */
export function WindowFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full overflow-hidden rounded-lg border border-border bg-background text-left ${className}`}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <WindowDots />
        {title && <span className="font-mono text-xs uppercase text-muted-foreground">{title}</span>}
      </div>
      {children}
    </div>
  );
}

/* ─── Chat widget ─── */

export type ChatMessage = {
  from: "visitor" | "team";
  text: string;
  /** Small mono caption above a team message, e.g. "AI agent". */
  label?: string;
};

const defaultChat: ChatMessage[] = [
  { from: "visitor", text: "Hey! Does this work with Next.js?" },
  { from: "team", text: "Yes, it's one script tag. Works with any framework.", label: "via Slack" },
  { from: "visitor", text: "Perfect, signing up now." },
];

export function ChatWidgetMock({ messages = defaultChat }: { messages?: ChatMessage[] }) {
  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-lg border border-border bg-background text-left">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            C
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-slack-green" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Crolyo Support</p>
          <p className="text-xs text-muted-foreground">Usually replies in minutes</p>
        </div>
      </div>

      <div className="flex min-h-[200px] flex-col justify-end gap-3 px-4 py-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "visitor" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3.5 py-2 text-sm leading-relaxed ${
                msg.from === "visitor"
                  ? "bg-foreground text-background"
                  : "border border-border bg-muted/60 text-foreground"
              }`}
            >
              {msg.label && (
                <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-brand">
                  {msg.label}
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm text-muted-foreground">Type a message…</span>
          <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ─── Slack thread ─── */

export type SlackMessage = {
  author: string;
  /** Renders the green APP tag next to the author. */
  app?: boolean;
  text: ReactNode;
};

const defaultThread: SlackMessage[] = [
  {
    author: "Crolyo",
    app: true,
    text: (
      <>
        <span className="text-[#ababad]">Visitor on /pricing:</span> Hey! Does this work with Next.js?
      </>
    ),
  },
  { author: "You", text: "Yes, it's one script tag. Works with any framework." },
];

/* Slack's own dark palette, so this mock looks the same in both themes. */
export function SlackThreadMock({
  channel = "support",
  messages = defaultThread,
}: {
  channel?: string;
  messages?: SlackMessage[];
}) {
  const [root, ...replies] = messages;
  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-lg border border-[#3f4144] bg-[#1a1d21] text-left">
      <div className="flex items-center gap-2 border-b border-[#3f4144] bg-[#222529] px-4 py-2.5">
        <SlackIcon className="size-3.5" />
        <span className="text-sm font-bold text-[#d1d2d3]">#{channel}</span>
      </div>
      <div className="space-y-3 p-4">
        <SlackRow message={root} />
        <div className="ml-4 space-y-3 border-l-2 border-[#3f4144] pl-4">
          {replies.map((reply, i) => (
            <SlackRow key={i} message={reply} small />
          ))}
          <div className="rounded-md border border-[#3f4144] px-3 py-1.5 text-[13px] text-[#ababad]">Reply…</div>
        </div>
      </div>
    </div>
  );
}

function SlackRow({ message, small = false }: { message: SlackMessage; small?: boolean }) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex shrink-0 items-center justify-center rounded font-bold text-white ${
          small ? "size-6 text-[10px]" : "size-8 text-xs"
        } ${message.app ? "bg-brand" : "bg-[#5865b8]"}`}
      >
        {message.author.charAt(0)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#d1d2d3]">{message.author}</span>
          {message.app && (
            <span className="rounded bg-[#2eb67d] px-1 text-[9px] font-bold uppercase tracking-wider text-white">
              App
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-[#d1d2d3]">{message.text}</div>
      </div>
    </div>
  );
}

/* ─── Phone with a Slack notification ─── */

export function PhoneMock() {
  return (
    <div className="relative flex h-[320px] w-[170px] flex-col rounded-[2rem] border-4 border-foreground/80 bg-background">
      <div className="mx-auto mt-2 h-4 w-16 rounded-full bg-foreground/80" />
      <div className="mx-2 mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/60 p-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slack-aubergine">
          <SlackIcon className="size-3.5" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-semibold text-foreground">#support</p>
          <p className="text-[10px] leading-snug text-muted-foreground">Visitor: Do you offer annual plans?</p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 p-4">
        <div className="h-2 w-1/2 rounded-full bg-muted" />
        <div className="h-2 w-3/4 rounded-full bg-muted" />
        <div className="h-24 w-full rounded-lg bg-muted" />
      </div>
    </div>
  );
}

/* ─── Knowledge base sources ─── */

const sources = [
  { kind: "URL", name: "docs.yoursite.com", meta: "Crawled · syncs daily" },
  { kind: "File", name: "pricing-2026.pdf", meta: "Uploaded" },
  { kind: "Text", name: "Refund policy", meta: "Pasted" },
];

export function KnowledgeMock() {
  return (
    <WindowFrame title="Knowledge" className="max-w-[440px]">
      <ul>
        {sources.map((source) => (
          <li key={source.name} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <span className="w-11 shrink-0 rounded border border-border py-0.5 text-center font-mono text-[10px] uppercase text-muted-foreground">
              {source.kind}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
              <p className="text-xs text-muted-foreground">{source.meta}</p>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-foreground">
              <span className="size-1.5 rounded-full bg-slack-green" />
              Ready
            </span>
          </li>
        ))}
      </ul>
    </WindowFrame>
  );
}

/* ─── Embed snippet ─── */

export function CodeMock() {
  return (
    <WindowFrame title="index.html" className="max-w-[520px]">
      <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
        <code>
          <span className="text-muted-foreground">{"<!-- Paste before </body> -->"}</span>
          {"\n"}
          <span className="text-brand">{"<script"}</span>
          {"\n  "}
          <span className="text-foreground">src</span>
          <span className="text-muted-foreground">{'="https://crolyo.ameyashr.in/widget.js"'}</span>
          {"\n  "}
          <span className="text-foreground">data-site-id</span>
          <span className="text-muted-foreground">{'="YOUR_SITE_ID"'}</span>
          {"\n  "}
          <span className="text-foreground">async defer</span>
          {"\n"}
          <span className="text-brand">{"></script>"}</span>
        </code>
      </pre>
    </WindowFrame>
  );
}

/* ─── Connect Slack checklist ─── */

const slackSteps = ["Workspace connected", "Channel #support selected", "Crolyo joined the channel"];

export function ConnectSlackMock() {
  return (
    <WindowFrame title="Slack" className="max-w-[400px]">
      <ul>
        {slackSteps.map((step) => (
          <li key={step} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
            <svg className="size-4 shrink-0 text-slack-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-foreground">{step}</span>
          </li>
        ))}
      </ul>
    </WindowFrame>
  );
}

/* ─── Site switcher ─── */

const sites = [
  { initial: "S", name: "Acme Store", domain: "acme.store", channel: "support-store" },
  { initial: "D", name: "Acme Docs", domain: "docs.acme.dev", channel: "support-docs" },
];

export function SitesMock() {
  return (
    <WindowFrame title="Sites" className="max-w-[400px]">
      <ul>
        {sites.map((site) => (
          <li key={site.domain} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-foreground">
              {site.initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{site.name}</p>
              <p className="text-xs text-muted-foreground">{site.domain}</p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">#{site.channel}</span>
          </li>
        ))}
      </ul>
      <div className="px-4 py-3">
        <div className="rounded-lg border border-dashed border-border py-2 text-center text-sm text-muted-foreground">
          + New site
        </div>
      </div>
    </WindowFrame>
  );
}
