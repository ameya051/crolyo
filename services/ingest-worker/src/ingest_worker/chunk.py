"""Heading-aware, token-bounded chunking with stable content hashes."""

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass
from typing import cast

import semchunk

CHUNK_TOKENS = 400
CHUNK_OVERLAP = 0.15
MIN_CHUNK_CHARS = 20

HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
FENCE = re.compile(r"^\s*(```|~~~)")


def count_tokens(text: str) -> int:
    """Approximate token count (~4 chars per token). Good enough for sizing
    chunks, and needs no tokenizer download at runtime."""
    return max(1, math.ceil(len(text) / 4))


def normalize_for_hash(text: str) -> str:
    """Whitespace and Unicode-form changes shouldn't count as content changes."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def content_hash(title: str, content: str) -> str:
    payload = f"{normalize_for_hash(title)}\n{normalize_for_hash(content)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


@dataclass
class Section:
    path: list[str]
    body: str


@dataclass
class ChunkDraft:
    title: str
    content: str
    content_hash: str

    @property
    def embedding_input(self) -> str:
        return f"{self.title}\n\n{self.content}" if self.title else self.content


def split_sections(markdown: str) -> list[Section]:
    sections: list[Section] = []
    stack: list[tuple[int, str]] = []
    buffer: list[str] = []
    in_fence = False

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if body or stack:
            sections.append(Section(path=[title for _, title in stack], body=body))
        buffer.clear()

    for line in markdown.splitlines():
        if FENCE.match(line):
            in_fence = not in_fence
        match = None if in_fence else HEADING.match(line)
        if match:
            flush()
            level = len(match.group(1))
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, match.group(2).strip()))
        else:
            buffer.append(line)
    flush()
    return sections


def _split(body: str) -> list[str]:
    pieces = semchunk.chunk(  # type: ignore[attr-defined]
        body, chunk_size=CHUNK_TOKENS, token_counter=count_tokens, overlap=CHUNK_OVERLAP
    )
    return cast(list[str], pieces)


def chunk_document(markdown: str, doc_title: str) -> list[ChunkDraft]:
    drafts: list[ChunkDraft] = []
    doc_title = doc_title.strip()
    for section in split_sections(clean_text(markdown)):
        path = [part for part in section.path if part]
        if path and doc_title and path[0].casefold() == doc_title.casefold():
            path = path[1:]
        title = " > ".join([part for part in [doc_title, *path] if part])[:500]

        body = section.body
        if not body:
            continue
        pieces = _split(body) if count_tokens(body) > CHUNK_TOKENS else [body]
        for piece in pieces:
            content = piece.strip()
            # Short answers under a descriptive heading ("Do you ship to Canada?" / "Yes.") are kept.
            if len(content) + len(path[-1] if path else "") < MIN_CHUNK_CHARS:
                continue
            drafts.append(ChunkDraft(title=title, content=content, content_hash=content_hash(title, content)))
    return drafts
