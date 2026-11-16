import Link from "next/link";
import { ChatWidgetMock, SlackThreadMock } from "@/app/components/mockups";
import { primaryCta, secondaryCta } from "@/app/components/styles";

export default function HeroSection() {
  return (
    <section>
      <div className="flex flex-col items-center gap-8 px-4 pt-14 text-center md:px-6 md:pt-24">
        {/* Announcement chip */}
        <Link href="#ai-agent" className="flex rounded-lg text-left hover:bg-muted">
          <span className="flex items-center rounded-l-lg bg-foreground px-4 py-2 font-mono text-xs font-medium uppercase leading-4 text-background">
            New
          </span>
          <span className="flex items-center rounded-r-lg border border-foreground py-1.5 pl-4 pr-3 text-sm font-medium leading-5 text-foreground">
            <span>
              <span className="hidden md:inline">AI agent: </span>Crolyo can now answer from your docs.
            </span>
          </span>
        </Link>

        <div className="flex flex-col gap-4">
          <h1 className="font-display text-[40px] font-light leading-[1.1] tracking-[-0.02em] text-foreground lg:text-[80px]">
            Live chat for <em className="text-brand">teams</em> who <br className="hidden md:inline" />
            live in <em className="text-brand">Slack</em>
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground md:text-xl">
            A lightweight chat widget for your site. Every conversation lands in a Slack thread,
            <br className="hidden md:inline" /> and an AI agent answers from your knowledge base until you step in.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/signup" className={primaryCta}>
            Get started free
          </Link>
          <Link href="#live-chat" className={secondaryCta}>
            See how it works
          </Link>
        </div>
      </div>

      {/* Widget on the left, the same conversation in Slack on the right */}
      <div className="mt-12 grid items-center justify-items-center gap-6 border-t border-border bg-muted/40 px-4 py-10 md:mt-20 md:grid-cols-2 md:px-10 md:py-14">
        <ChatWidgetMock />
        <SlackThreadMock />
      </div>
    </section>
  );
}
