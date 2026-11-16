import type { KnowledgeJobStatus, KnowledgeSourceStatus, KnowledgeSourceType } from "./enums"

export type KnowledgeSourceRow = {
  id: string
  site_id: string
  type: KnowledgeSourceType
  title: string
  url: string | null
  crawl: boolean
  sync_interval_hours: number | null
  next_sync_at: string | null
  webhook_token_hash: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  status: KnowledgeSourceStatus
  error: string | null
  active_version: number
  last_synced_at: string | null
  page_count: number
  chunk_count: number
  created_at: string
  updated_at: string
}

export type KnowledgeSource = {
  id: string
  siteId: string
  type: KnowledgeSourceType
  title: string
  url: string | null
  crawl: boolean
  syncIntervalHours: number | null
  nextSyncAt: string | null
  hasWebhook: boolean
  fileName: string | null
  status: KnowledgeSourceStatus
  error: string | null
  activeVersion: number
  lastSyncedAt: string | null
  pageCount: number
  chunkCount: number
  /** Status of the queued/running job for this source, if any. */
  liveJobStatus: Extract<KnowledgeJobStatus, "queued" | "running"> | null
  /** Pages carried over from an earlier version because they failed to load. */
  stalePageCount: number
  createdAt: string
}

export type KnowledgeConflict = {
  id: string
  similarity: number
  chunk: { sourceId: string; sourceTitle: string; title: string; excerpt: string }
  otherChunk: { sourceId: string; sourceTitle: string; title: string; excerpt: string }
}

export type ActionResult<T = null> =
  | { ok: true; data: T; error?: never }
  | { ok?: never; data?: never; error: string }
