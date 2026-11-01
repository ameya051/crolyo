import { describe, expect, it } from "vitest";

import { detectHumanRequest } from "@/lib/agent/guards";

describe("detectHumanRequest", () => {
  it.each([
    "connect me to a human",
    "Can I talk to someone?",
    "I want to speak with a real person",
    "transfer me to an agent please",
    "put me through to your support team",
    "I need a human",
    "I'd like a live agent",
    "real person please",
    "human",
    "Agent!",
    "can I chat with customer service",
  ])("matches an explicit request: %s", (text) => {
    expect(detectHumanRequest(text)).toBe(true);
  });

  it.each([
    "what's your refund policy?",
    "How do I add a team member to my workspace?",
    "Does your agent software support Zendesk?",
    "Do you ship to Canada?",
    "I need a person's name on the invoice",
    "How do I connect my Slack to the support channel?",
    "",
  ])("does not match an ordinary question: %s", (text) => {
    expect(detectHumanRequest(text)).toBe(false);
  });
});
