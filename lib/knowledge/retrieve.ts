import { embedQuery } from "@/lib/knowledge/embed-query";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUpdatedAt: string | null;
  pageUrl: string | null;
  title: string;
  content: string;
};

type MatchRow = {
  id: string;
  source_id: string;
  source_title: string;
  source_updated_at: string | null;
  page_url: string | null;
  title: string;
  content: string;
};

/** Hybrid (full-text + vector) retrieval over a site's active knowledge. */
export async function retrieveContext(siteId: string, query: string, count = 8): Promise<RetrievedChunk[]> {
  const embedded = await embedQuery(query);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_knowledge_chunks", {
    p_site_id: siteId,
    p_query: query,
    // pgvector accepts its text form ("[0.1,0.2,...]") over PostgREST.
    p_embedding: embedded ? JSON.stringify(embedded.embedding) : null,
    p_embedding_model: embedded?.model ?? null,
    p_match_count: count,
  });

  if (error) {
    logger.error("knowledge.retrieve.failed", error, { siteId, errorCode: error.code });
    throw new Error("Knowledge retrieval failed");
  }

  const rows = (data ?? []) as MatchRow[];
  logger.info("knowledge.retrieve.succeeded", {
    siteId,
    resultCount: rows.length,
    usedVectors: Boolean(embedded),
  });
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    sourceUpdatedAt: row.source_updated_at,
    pageUrl: row.page_url,
    title: row.title,
    content: row.content,
  }));
}
