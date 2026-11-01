"""Queue re-embedding after changing EMBEDDING_MODEL:

    uv run python -m ingest_worker.reembed

Enqueues a 'reembed' job for every source whose live chunks are missing
embeddings from the current model. Each job runs the normal versioned sync,
so vector search keeps serving the old embeddings' sources via full-text
until the new version activates.
"""

import asyncio

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from ingest_worker import db
from ingest_worker.config import Settings
from ingest_worker.logging_setup import configure_logging, log


async def main() -> None:
    settings = Settings()  # type: ignore[call-arg]
    configure_logging(settings.log_level)
    async with await AsyncConnection.connect(
        settings.database_url, autocommit=True, row_factory=dict_row
    ) as conn:
        count = await db.enqueue_reembed_all(conn, settings.embedding_model)
    log.info("reembed.enqueued", count=count, model=settings.embedding_model)


if __name__ == "__main__":
    asyncio.run(main())
