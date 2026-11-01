import os
import socket

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_worker_id() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


class Settings(BaseSettings):
    """Worker configuration, read from environment variables (or a local .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase Postgres via the *session* pooler (port 5432) or a direct
    # connection. The transaction pooler can't carry LISTEN/NOTIFY.
    database_url: str
    supabase_url: str
    supabase_secret_key: str

    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    embedding_model: str = "voyageai/voyage-4-large"
    embedding_dimensions: int = 1024
    embedding_batch_size: int = 64

    worker_id: str = Field(default_factory=_default_worker_id)
    worker_concurrency: int = 3
    lease_seconds: int = 300
    lease_renew_seconds: int = 60
    max_attempts: int = 3
    poll_interval_seconds: float = 5.0
    schedule_interval_seconds: float = 60.0
    shutdown_grace_seconds: float = 90.0
    heartbeat_path: str = "/tmp/ingest-worker-heartbeat"  # noqa: S108 - container-local liveness file

    max_crawl_pages: int = 20
    crawl_concurrency: int = 3
    max_chunks_per_site: int = 3000
    fetch_timeout_seconds: float = 10.0
    max_page_bytes: int = 3 * 1024 * 1024
    max_file_bytes: int = 20 * 1024 * 1024
    conflict_threshold: float = 0.92

    log_level: str = "INFO"
