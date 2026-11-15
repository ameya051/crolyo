"""Builds the next version of a source from fetch outcomes and the live version.

Pure logic (no I/O) so the re-index rules are easy to test:
  * unchanged page (304 or same content hash) -> carry its chunks over
  * changed page -> re-chunk; reuse embeddings for chunk hashes we already have
  * 404/410 or no longer linked -> dropped
  * transient failure -> keep the previous copy, marked stale
"""

from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Literal

from ingest_worker.chunk import chunk_document, content_hash

OutcomeKind = Literal["ok", "not_modified", "gone", "transient"]


@dataclass
class PageOutcome:
    url: str
    kind: OutcomeKind
    http_status: int | None = None
    title: str = ""
    markdown: str = ""
    etag: str | None = None
    last_modified: str | None = None
    links: list[str] = field(default_factory=list)


@dataclass
class StoredChunk:
    page_url: str | None
    title: str
    content: str
    content_hash: str
    embedding: str | None
    embedding_model: str | None


@dataclass
class StoredPage:
    url: str
    title: str | None
    etag: str | None
    last_modified: str | None
    content_hash: str
    links: list[str]
    stale_since: datetime | None
    chunks: list[StoredChunk] = field(default_factory=list)


@dataclass
class NewPage:
    url: str
    title: str | None
    etag: str | None
    last_modified: str | None
    content_hash: str
    links: list[str]
    last_status: int | None
    stale_since: datetime | None


@dataclass
class NewChunk:
    page_url: str | None
    title: str
    content: str
    content_hash: str
    chunk_index: int
    embedding: str | None
    embedding_model: str | None

    @property
    def embedding_input(self) -> str:
        return f"{self.title}\n\n{self.content}" if self.title else self.content


@dataclass
class VersionPlan:
    pages: list[NewPage]
    chunks: list[NewChunk]
    attempted: int
    transient_failures: int
    changed_pages: int
    reused_pages: int

    @property
    def missing_embeddings(self) -> list[int]:
        return [index for index, chunk in enumerate(self.chunks) if chunk.embedding is None]


def page_hash(title: str, markdown: str) -> str:
    return content_hash(title, markdown)


def plan_version(
    outcomes: list[PageOutcome],
    previous: dict[str, StoredPage],
    embedding_cache: dict[str, str],
    embedding_model: str,
    now: datetime,
    *,
    chunk_page_urls: bool = True,
) -> VersionPlan:
    pages: list[NewPage] = []
    chunks: list[NewChunk] = []
    transient = changed = reused = 0

    def add_chunk(
        page_url: str | None,
        title: str,
        content: str,
        chunk_hash: str,
        embedding: str | None,
        model: str | None,
    ) -> None:
        if embedding is None or model != embedding_model:
            cached = embedding_cache.get(chunk_hash)
            embedding, model = (cached, embedding_model) if cached else (None, None)
        chunks.append(NewChunk(page_url, title, content, chunk_hash, len(chunks), embedding, model))

    def carry_over(prev: StoredPage) -> None:
        for chunk in prev.chunks:
            add_chunk(
                chunk.page_url,
                chunk.title,
                chunk.content,
                chunk.content_hash,
                chunk.embedding,
                chunk.embedding_model,
            )

    for outcome in outcomes:
        prev = previous.get(outcome.url)
        chunk_url = outcome.url if chunk_page_urls else None

        if outcome.kind == "ok":
            new_hash = page_hash(outcome.title, outcome.markdown)
            pages.append(
                NewPage(
                    outcome.url,
                    outcome.title or None,
                    outcome.etag,
                    outcome.last_modified,
                    new_hash,
                    outcome.links,
                    outcome.http_status,
                    None,
                )
            )
            if prev is not None and prev.content_hash == new_hash:
                reused += 1
                carry_over(prev)
            else:
                changed += 1
                for draft in chunk_document(outcome.markdown, outcome.title):
                    add_chunk(chunk_url, draft.title, draft.content, draft.content_hash, None, None)

        elif outcome.kind == "not_modified" and prev is not None:
            reused += 1
            pages.append(
                NewPage(
                    prev.url,
                    prev.title,
                    outcome.etag or prev.etag,
                    outcome.last_modified or prev.last_modified,
                    prev.content_hash,
                    prev.links,
                    outcome.http_status,
                    None,
                )
            )
            carry_over(prev)

        elif outcome.kind == "transient":
            transient += 1
            if prev is not None:
                pages.append(
                    NewPage(
                        prev.url,
                        prev.title,
                        prev.etag,
                        prev.last_modified,
                        prev.content_hash,
                        prev.links,
                        outcome.http_status,
                        prev.stale_since or now,
                    )
                )
                carry_over(prev)
        # "gone" (and a 304 with nothing to carry over) drops the page.

    return VersionPlan(
        pages=pages,
        chunks=chunks,
        attempted=len(outcomes),
        transient_failures=transient,
        changed_pages=changed,
        reused_pages=reused,
    )


def with_embeddings(plan: VersionPlan, vectors: dict[int, str], model: str) -> VersionPlan:
    chunks = [
        replace(chunk, embedding=vectors[index], embedding_model=model) if index in vectors else chunk
        for index, chunk in enumerate(plan.chunks)
    ]
    return replace(plan, chunks=chunks)
