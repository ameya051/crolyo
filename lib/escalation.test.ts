import { describe, expect, it } from "vitest";

import { buildThreadRootText, formatTranscript } from "@/lib/escalation";

describe("formatTranscript", () => {
  it("labels each sender", () => {
    expect(
      formatTranscript([
        { sender_type: "visitor", content: "Hi" },
        { sender_type: "ai", content: "Hello!" },
        { sender_type: "agent", content: "Sam here." },
      ])
    ).toBe("Visitor: Hi\nAI: Hello!\nAgent: Sam here.");
  });

  it("keeps the newest messages when over budget and says how many were left out", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      sender_type: "visitor" as const,
      content: `message ${index}`,
    }));
    const transcript = formatTranscript(messages);
    expect(transcript.startsWith("(10 earlier messages not shown)")).toBe(true);
    expect(transcript).toContain("message 39");
    expect(transcript).not.toContain("message 9\n");

    const tight = formatTranscript(messages.slice(-3), 30);
    expect(tight).toContain("message 39");
    expect(tight).toContain("earlier message");
  });
});

describe("buildThreadRootText", () => {
  it("leads with the escalation reason and summary", () => {
    const text = buildThreadRootText(
      { name: "Acme" },
      { escalation_reason: "high_risk", escalation_summary: "Visitor disputes a double charge." },
      [{ sender_type: "visitor", content: "I was charged twice!" }]
    );
    expect(text.split("\n")[0]).toBe("Escalated chat from Acme: High-risk query");
    expect(text).toContain("Summary: Visitor disputes a double charge.");
    expect(text).toContain("Visitor: I was charged twice!");
    expect(text).toContain("Reply in this thread");
  });

  it("works for conversations that were never escalated", () => {
    const text = buildThreadRootText({ name: "Acme" }, { escalation_reason: null, escalation_summary: null }, []);
    expect(text.startsWith("Chat from Acme")).toBe(true);
    expect(text).not.toContain("Summary:");
  });
});
