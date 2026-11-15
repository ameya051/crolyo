"""Mirrors of the Postgres enums in supabase/migrations.

tests/test_db.py compares these against pg_enum so drift fails CI. The
TypeScript side mirrors the same values in lib/types/enums.ts.
"""

from enum import StrEnum


class KnowledgeSourceType(StrEnum):
    URL = "url"
    FILE = "file"
    TEXT = "text"


class KnowledgeSourceStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class KnowledgeJobKind(StrEnum):
    SYNC = "sync"
    REEMBED = "reembed"


class KnowledgeJobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


# Enums owned by the Next.js app; mirrored here only so the drift test covers
# every enum in the schema.
class ConversationMode(StrEnum):
    AI = "ai"
    HUMAN = "human"


class ConversationStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class MessageSenderType(StrEnum):
    VISITOR = "visitor"
    AGENT = "agent"
    AI = "ai"


class EscalationReason(StrEnum):
    VISITOR_REQUESTED = "visitor_requested"
    HIGH_RISK = "high_risk"
    UNANSWERABLE = "unanswerable"
    AGENT_ERROR = "agent_error"


PG_ENUMS: dict[str, type[StrEnum]] = {
    "knowledge_source_type": KnowledgeSourceType,
    "knowledge_source_status": KnowledgeSourceStatus,
    "knowledge_job_kind": KnowledgeJobKind,
    "knowledge_job_status": KnowledgeJobStatus,
    "conversation_mode": ConversationMode,
    "conversation_status": ConversationStatus,
    "message_sender_type": MessageSenderType,
    "escalation_reason": EscalationReason,
}
