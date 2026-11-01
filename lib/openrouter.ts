/**
 * OpenRouter configuration shared by the agent (Claude through OpenRouter's
 * Anthropic-compatible Messages endpoint) and query embeddings.
 *
 * The ingest worker (services/ingest-worker) reads the same EMBEDDING_* env
 * vars; both sides must agree or vector search silently stops matching.
 */

export const OPENROUTER_API_BASE = "https://openrouter.ai/api";

export const DEFAULT_AGENT_MODEL = "anthropic/claude-sonnet-5.5";
export const DEFAULT_EMBEDDING_MODEL = "voyageai/voyage-4-large";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export function openRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}

export function agentModel(): string {
  return process.env.AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL;
}

export function embeddingConfig(): { model: string; dimensions: number } {
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS);
  return {
    model: process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    dimensions: Number.isInteger(dimensions) && dimensions > 0 ? dimensions : DEFAULT_EMBEDDING_DIMENSIONS,
  };
}
