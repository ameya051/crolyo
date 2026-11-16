import HeroSection from "@/app/components/HeroSection";
import FeatureStrip from "@/app/components/FeatureStrip";
import FactsRow from "@/app/components/FactsRow";
import ShowcaseSection from "@/app/components/ShowcaseSection";
import SplitPanel from "@/app/components/SplitPanel";
import CtaSection from "@/app/components/CtaSection";
import {
  ChatWidgetMock,
  CodeMock,
  ConnectSlackMock,
  KnowledgeMock,
  PhoneMock,
  SlackThreadMock,
} from "@/app/components/mockups";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <FeatureStrip />
        <FactsRow />

        <ShowcaseSection
          id="live-chat"
          eyebrow="#01 - Live chat"
          heading="Talk to visitors without leaving Slack."
          tabs={[
            {
              title: "Widget",
              description: "A small chat widget your visitors can open on any page, with no account needed.",
              panel: <ChatWidgetMock />,
            },
            {
              title: "Slack threads",
              description: "Every conversation opens a thread in your channel. Reply in the thread and it reaches the visitor.",
              panel: <SlackThreadMock />,
            },
            {
              title: "Mobile",
              description: "No extra app. Answer from the Slack app on your phone, wherever you are.",
              panel: <PhoneMock />,
            },
          ]}
        />

        <ShowcaseSection
          id="ai-agent"
          eyebrow="#02 - AI agent"
          heading="Answers from your docs, hand-off to your team."
          tabs={[
            {
              title: "Knowledge base",
              description: "Add URLs to crawl, upload files or paste text. URL sources re-sync on a schedule.",
              panel: <KnowledgeMock />,
            },
            {
              title: "Instant answers",
              description: "The agent replies to visitors right away, using only what is in your knowledge base.",
              panel: (
                <ChatWidgetMock
                  messages={[
                    { from: "visitor", text: "Can I get a refund after 10 days?" },
                    {
                      from: "team",
                      label: "AI agent",
                      text: "Yes. Refunds are available within 14 days of purchase.",
                    },
                  ]}
                />
              ),
            },
            {
              title: "Escalation",
              description: "When the agent can't help, the conversation is escalated to Slack for a person to pick up.",
              panel: (
                <SlackThreadMock
                  messages={[
                    {
                      author: "Crolyo",
                      app: true,
                      text: (
                        <>
                          <span className="text-[#ababad]">Escalated by AI agent:</span> Visitor is asking for a
                          custom enterprise quote.
                        </>
                      ),
                    },
                    { author: "You", text: "Happy to help! How many seats do you need?" },
                  ]}
                />
              ),
            },
          ]}
        />

        <ShowcaseSection
          id="setup"
          eyebrow="#03 - Setup"
          heading="Live in the time it takes to make coffee."
          tabs={[
            {
              title: "Embed snippet",
              description: "Copy one script tag from your dashboard and paste it before the closing body tag.",
              panel: <CodeMock />,
            },
            {
              title: "Connect Slack",
              description: "Authorize your workspace and pick a channel. Crolyo joins it automatically.",
              panel: <ConnectSlackMock />,
            },
          ]}
        />

        <SplitPanel />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
