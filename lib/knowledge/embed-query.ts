import { logger } from "@/lib/logger";
import { embeddingConfig, OPENROUTER_API_BASE, openRouterApiKey } from "@/lib/openrouter";

const QUERY_TIMEOUT_MS = 8_000;

type EmbeddingResponse = {
  data?: { embedding?: number[] }[];
  error?: { message?: string; code?: number | string };
};

/**
 * Embeds a visitor query for vector search. Returns null (and retrieval falls
 * back to full-text only) when OpenRouter isn't configured or the call fails,
 * so a provider hiccup never blocks an answer.
 */
export async function embedQuery(text: string): Promise<{ embedding: number[]; model: string } | null> {
  const apiKey = openRouterApiKey();
  if (!apiKey) return null;

  const { model, dimensions } = embeddingConfig();
  const startedAt = Date.now();
  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/v1/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [text],
        input_type: "search_query",
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    const payload = (await response.json()) as EmbeddingResponse;
    const embedding = payload.data?.[0]?.embedding;

    if (!response.ok || !embedding) {
      logger.warn("knowledge.embed_query.rejected", {
        status: response.status,
        errorCode: payload.error?.code,
        durationMs: Date.now() - startedAt,
      });
      return null;
    }
    if (embedding.length !== dimensions) {
      logger.error("knowledge.embed_query.dimension_mismatch", undefined, {
        expected: dimensions,
        received: embedding.length,
      });
      return null;
    }

    logger.info("knowledge.embed_query.succeeded", { durationMs: Date.now() - startedAt });
    return { embedding, model };
  } catch (error) {
    logger.warn("knowledge.embed_query.failed", {
      reason: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - startedAt,
    });
    return null;
  }
}
