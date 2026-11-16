/**
 * Single source of truth (on the TypeScript side) for values backed by
 * Postgres enums in supabase/migrations. Keep these in sync with the SQL
 * `create type ... as enum` definitions and with
 * services/ingest-worker/src/ingest_worker/enums.py.
 */

export const CONVERSATION_MODES = ["ai", "human"] as const
export type ConversationMode = (typeof CONVERSATION_MODES)[number]

export const CONVERSATION_STATUSES = ["open", "closed"] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const MESSAGE_SENDER_TYPES = ["visitor", "agent", "ai"] as const
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number]

export const ESCALATION_REASONS = ["visitor_requested", "high_risk", "unanswerable", "agent_error"] as const
export type EscalationReason = (typeof ESCALATION_REASONS)[number]

export const KNOWLEDGE_SOURCE_TYPES = ["url", "file", "text"] as const
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number]

export const KNOWLEDGE_SOURCE_STATUSES = ["pending", "processing", "ready", "failed"] as const
export type KnowledgeSourceStatus = (typeof KNOWLEDGE_SOURCE_STATUSES)[number]

export const KNOWLEDGE_JOB_KINDS = ["sync", "reembed"] as const
export type KnowledgeJobKind = (typeof KNOWLEDGE_JOB_KINDS)[number]

export const KNOWLEDGE_JOB_STATUSES = ["queued", "running", "done", "failed"] as const
export type KnowledgeJobStatus = (typeof KNOWLEDGE_JOB_STATUSES)[number]
