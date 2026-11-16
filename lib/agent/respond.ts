import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { AGENT_SYSTEM_PROMPT, buildMessages, type HistoryMessage, knowledgeBlock, siteContextBlock } from "@/lib/agent/prompt";
import type { RetrievedChunk } from "@/lib/knowledge/retrieve";
import { logger } from "@/lib/logger";
import { agentModel, OPENROUTER_API_BASE, openRouterApiKey } from "@/lib/openrouter";

export const DecisionSchema = z.object({
  decision: z.enum(["answer", "escalate"]),
  reply: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
  escalation_reason: z.enum(["none", "visitor_requested", "high_risk", "unanswerable"]),
  summary: z.string(),
  used_chunk_ids: z.array(z.string()),
});

export type AgentDecision = z.infer<typeof DecisionSchema>;

export class AgentResponseError extends Error {}

/**
 * Claude through OpenRouter's Anthropic-compatible Messages endpoint, using the
 * Anthropic SDK. One OPENROUTER_API_KEY covers chat and embeddings.
 */
export function createAgentClient(): Anthropic {
  const apiKey = openRouterApiKey();
  if (!apiKey) throw new AgentResponseError("OPENROUTER_API_KEY is not configured");
  return new Anthropic({
    baseURL: OPENROUTER_API_BASE,
    authToken: apiKey,
    apiKey: null,
    timeout: 30_000,
    maxRetries: 1,
  });
}

export async function decideReply(input: {
  site: { name: string; ai_agent_instructions: string };
  history: HistoryMessage[];
  chunks: RetrievedChunk[];
  client?: Anthropic;
}): Promise<AgentDecision> {
  const client = input.client ?? createAgentClient();
  const model = agentModel();
  const startedAt = Date.now();

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: [
      { type: "text", text: AGENT_SYSTEM_PROMPT },
      { type: "text", text: siteContextBlock(input.site) },
    ],
    messages: buildMessages(input.history, knowledgeBlock(input.chunks)),
    output_config: {
      effort: "low",
      format: zodOutputFormat(DecisionSchema),
    },
  });

  logger.info("agent.decide.completed", {
    model: response.model,
    stopReason: response.stop_reason,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    durationMs: Date.now() - startedAt,
  });

  if (response.stop_reason === "refusal") {
    throw new AgentResponseError("The model declined to respond");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AgentResponseError("The model response was cut off");
  }
  const decision = response.parsed_output;
  if (!decision) {
    throw new AgentResponseError("The model response could not be parsed");
  }

  const validIds = new Set(input.chunks.map((chunk) => chunk.id));
  return {
    ...decision,
    reply: decision.reply.trim(),
    summary: decision.summary.trim(),
    used_chunk_ids: decision.used_chunk_ids.filter((id) => validIds.has(id)),
  };
}
