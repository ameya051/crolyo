import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { buildMessages, knowledgeBlock } from "@/lib/agent/prompt";
import { AgentResponseError, type AgentDecision, decideReply } from "@/lib/agent/respond";
import type { RetrievedChunk } from "@/lib/knowledge/retrieve";

const site = { name: "Acme", ai_agent_instructions: "Be brief." };
const chunks: RetrievedChunk[] = [
  {
    id: "chunk-1",
    sourceId: "source-1",
    sourceTitle: "Help Center",
    sourceUpdatedAt: "2026-10-30T12:00:00Z",
    pageUrl: "https://acme.com/help",
    title: "Help > Refunds",
    content: "Refunds are available within 30 days.",
  },
];

function clientReturning(response: Partial<Anthropic.Message> & { parsed_output: AgentDecision | null }) {
  const parse = vi.fn().mockResolvedValue({
    model: "anthropic/claude-sonnet-5.5",
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5 },
    content: [],
    ...response,
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

const answer: AgentDecision = {
  decision: "answer",
  reply: "  We offer refunds within 30 days.  ",
  risk_level: "low",
  escalation_reason: "none",
  summary: "Asked about refunds.",
  used_chunk_ids: ["chunk-1", "made-up-id"],
};

describe("decideReply", () => {
  it("returns the parsed decision, trimmed, keeping only real chunk ids", async () => {
    const { client, parse } = clientReturning({ parsed_output: answer });
    const decision = await decideReply({
      site,
      history: [{ sender_type: "visitor", content: "Can I get a refund?" }],
      chunks,
      client,
    });
    expect(decision.reply).toBe("We offer refunds within 30 days.");
    expect(decision.used_chunk_ids).toEqual(["chunk-1"]);

    const request = parse.mock.calls[0][0];
    expect(request.model).toBe("anthropic/claude-sonnet-5.5");
    expect(request.output_config.effort).toBe("low");
    expect(request.output_config.format).toBeDefined();
    expect(JSON.stringify(request.system)).toContain("Be brief.");
  });

  it("throws on refusals so the caller escalates", async () => {
    const { client } = clientReturning({ parsed_output: null, stop_reason: "refusal" });
    await expect(
      decideReply({ site, history: [{ sender_type: "visitor", content: "hi" }], chunks, client })
    ).rejects.toBeInstanceOf(AgentResponseError);
  });

  it("throws when the output can't be parsed", async () => {
    const { client } = clientReturning({ parsed_output: null });
    await expect(
      decideReply({ site, history: [{ sender_type: "visitor", content: "hi" }], chunks, client })
    ).rejects.toThrow("could not be parsed");
  });

  it("throws when the response was cut off", async () => {
    const { client } = clientReturning({ parsed_output: answer, stop_reason: "max_tokens" });
    await expect(
      decideReply({ site, history: [{ sender_type: "visitor", content: "hi" }], chunks, client })
    ).rejects.toThrow("cut off");
  });
});

describe("buildMessages", () => {
  it("maps senders to roles, drops leading assistant turns and attaches knowledge to the last turn", () => {
    const messages = buildMessages(
      [
        { sender_type: "ai", content: "Welcome!" },
        { sender_type: "visitor", content: "Do you ship to Canada?" },
        { sender_type: "ai", content: "Yes, in 5 days." },
        { sender_type: "agent", content: "Hi, Sam from Acme here." },
        { sender_type: "visitor", content: "And refunds?" },
      ],
      knowledgeBlock(chunks)
    );
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "assistant", "user"]);
    const last = messages[messages.length - 1].content as Anthropic.TextBlockParam[];
    expect(last[0].text).toContain('<entry id="chunk-1" source="Help Center" updated="2026-10-30"');
    expect(last[1].text).toContain("And refunds?");
  });

  it("requires the latest message to be from the visitor", () => {
    expect(() =>
      buildMessages([{ sender_type: "visitor", content: "hi" }, { sender_type: "ai", content: "hello" }], "")
    ).toThrow();
  });

  it("says so when no knowledge was found", () => {
    expect(knowledgeBlock([])).toContain("No relevant knowledge");
  });
});
