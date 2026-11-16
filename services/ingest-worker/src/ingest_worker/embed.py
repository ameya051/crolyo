"""Batch document embeddings through OpenRouter's embeddings endpoint."""

import asyncio
import random

import httpx

from ingest_worker.config import Settings
from ingest_worker.errors import PermanentSyncError, TransientSyncError
from ingest_worker.logging_setup import log

RETRYABLE_STATUS = {408, 429, 500, 502, 503, 524, 529}
MAX_RETRIES = 4


def to_pgvector(values: list[float]) -> str:
    """pgvector's text input form."""
    return "[" + ",".join(repr(float(value)) for value in values) + "]"


class Embedder:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._client = client

    @property
    def enabled(self) -> bool:
        return bool(self._settings.openrouter_api_key)

    @property
    def model(self) -> str:
        return self._settings.embedding_model

    async def embed_documents(self, texts: list[str]) -> list[str]:
        """Returns embeddings in pgvector text form, in input order."""
        results: list[str] = []
        size = self._settings.embedding_batch_size
        for start in range(0, len(texts), size):
            results.extend(await self._embed_batch(texts[start : start + size]))
        return results

    async def _embed_batch(self, batch: list[str]) -> list[str]:
        payload = {
            "model": self._settings.embedding_model,
            "input": batch,
            "input_type": "search_document",
            "encoding_format": "float",
        }
        headers = {"Authorization": f"Bearer {self._settings.openrouter_api_key}"}
        url = f"{self._settings.openrouter_base_url}/embeddings"

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self._client.post(url, json=payload, headers=headers, timeout=60.0)
            except httpx.TransportError as error:
                if attempt == MAX_RETRIES:
                    raise TransientSyncError("The embedding service couldn't be reached.") from error
                await self._backoff(attempt)
                continue

            if response.status_code in RETRYABLE_STATUS:
                if attempt == MAX_RETRIES:
                    raise TransientSyncError("The embedding service is temporarily unavailable.")
                log.warning("embed.retrying", status=response.status_code, attempt=attempt + 1)
                await self._backoff(attempt, response.headers.get("retry-after"))
                continue
            if response.status_code >= 400:
                log.error("embed.rejected", status=response.status_code)
                raise TransientSyncError("The embedding service rejected the request.")

            data = response.json().get("data") or []
            if len(data) != len(batch):
                raise TransientSyncError("The embedding service returned an incomplete response.")
            ordered = sorted(data, key=lambda item: item.get("index", 0))
            vectors: list[str] = []
            for item in ordered:
                embedding = item.get("embedding") or []
                if len(embedding) != self._settings.embedding_dimensions:
                    log.error(
                        "embed.dimension_mismatch",
                        expected=self._settings.embedding_dimensions,
                        received=len(embedding),
                    )
                    raise PermanentSyncError("Embedding configuration error. Please contact support.")
                vectors.append(to_pgvector(embedding))
            return vectors
        raise TransientSyncError("The embedding service is temporarily unavailable.")

    @staticmethod
    async def _backoff(attempt: int, retry_after: str | None = None) -> None:
        if retry_after and retry_after.isdigit():
            delay = min(float(retry_after), 30.0)
        else:
            delay = min(2.0**attempt, 16.0) + random.uniform(0, 0.5)  # noqa: S311 - jitter, not crypto
        await asyncio.sleep(delay)
