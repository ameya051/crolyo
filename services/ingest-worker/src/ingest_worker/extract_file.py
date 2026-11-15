"""Text extraction for uploaded documents: PDF, DOCX, TXT and Markdown.

Output is Markdown so the chunker can split on headings.
"""

import io
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

import pdfplumber
import pypdfium2
from charset_normalizer import from_bytes
from docx import Document as load_docx
from docx.table import Table
from docx.text.paragraph import Paragraph

from ingest_worker.errors import PermanentSyncError

# Table detection is the slow part of PDF parsing; skip it on very long files.
MAX_PDF_PAGES_FOR_TABLES = 100
MIN_CHARS_PER_PAGE = 20


@dataclass
class ExtractedDocument:
    title: str
    markdown: str


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _markdown_table(rows: Iterable[Iterable[Any]]) -> str:
    cleaned = [
        [re.sub(r"\s+", " ", str(cell or "")).strip().replace("|", "\\|") for cell in row] for row in rows
    ]
    cleaned = [row for row in cleaned if any(row)]
    if not cleaned:
        return ""
    width = max(len(row) for row in cleaned)
    cleaned = [row + [""] * (width - len(row)) for row in cleaned]
    header, *body = cleaned
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * width]
    lines += ["| " + " | ".join(row) + " |" for row in body]
    return "\n".join(lines)


def _inside(obj: dict[str, Any], bbox: tuple[float, float, float, float]) -> bool:
    x0, top, x1, bottom = bbox
    return bool(
        obj.get("x0", 0) >= x0
        and obj.get("x1", 0) <= x1
        and obj.get("top", 0) >= top
        and obj.get("bottom", 0) <= bottom
    )


def extract_pdf(data: bytes, title: str) -> ExtractedDocument:
    try:
        pdf = pypdfium2.PdfDocument(data)
    except pypdfium2.PdfiumError as error:
        raise PermanentSyncError(
            "This PDF couldn't be opened. It may be damaged or password protected."
        ) from error

    sections: list[str] = []
    total_chars = 0
    page_count = len(pdf)
    plumber = pdfplumber.open(io.BytesIO(data)) if page_count <= MAX_PDF_PAGES_FOR_TABLES else None
    try:
        for index in range(page_count):
            page = pdf[index]
            textpage = page.get_textpage()
            text = textpage.get_text_range()
            textpage.close()
            page.close()

            tables: list[str] = []
            if plumber is not None:
                plumber_page = plumber.pages[index]
                found = plumber_page.find_tables()
                if found:
                    # Use pdfplumber's text outside the tables so table cells
                    # aren't duplicated, then render tables as Markdown.
                    bboxes = [table.bbox for table in found]

                    def outside_tables(obj: dict[str, Any], boxes: list[Any] = bboxes) -> bool:
                        return not any(_inside(obj, bbox) for bbox in boxes)

                    text = plumber_page.filter(outside_tables).extract_text() or ""
                    tables = [md for md in (_markdown_table(table.extract()) for table in found) if md]

            body = _clean(text)
            total_chars += len(body) + sum(len(table) for table in tables)
            parts = [part for part in [body, *tables] if part]
            if parts:
                sections.append(f"## Page {index + 1}\n\n" + "\n\n".join(parts))
    finally:
        if plumber is not None:
            plumber.close()
        pdf.close()

    if total_chars < max(50, MIN_CHARS_PER_PAGE * page_count):
        raise PermanentSyncError(
            "This PDF has no selectable text (it may be a scan). Scanned PDFs aren't supported yet."
        )
    return ExtractedDocument(title=title, markdown="\n\n".join(sections))


def _iter_docx_blocks(document: Any) -> Iterable[Paragraph | Table]:
    body = document.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            yield Paragraph(child, document)
        elif tag == "tbl":
            yield Table(child, document)


def extract_docx(data: bytes, title: str) -> ExtractedDocument:
    try:
        document = load_docx(io.BytesIO(data))
    except Exception as error:  # python-docx raises several unrelated types for bad files
        raise PermanentSyncError(
            "This Word document couldn't be opened. Save it as .docx and try again."
        ) from error

    lines: list[str] = []
    for block in _iter_docx_blocks(document):
        if isinstance(block, Table):
            table = _markdown_table([cell.text for cell in row.cells] for row in block.rows)
            if table:
                lines.append(table)
            continue
        text = block.text.strip()
        if not text:
            continue
        style = (block.style.name if block.style is not None else "") or ""
        heading = re.match(r"Heading (\d)", style)
        if style == "Title":
            lines.append(f"# {text}")
        elif heading:
            lines.append(f"{'#' * min(int(heading.group(1)), 6)} {text}")
        elif "List" in style:
            lines.append(f"- {text}")
        else:
            lines.append(text)
    markdown = _clean("\n\n".join(lines))
    if not markdown:
        raise PermanentSyncError("This Word document doesn't contain any text.")
    return ExtractedDocument(title=title, markdown=markdown)


def decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        best = from_bytes(data).best()
        if best is None:
            raise PermanentSyncError(
                "This text file's encoding couldn't be detected. Save it as UTF-8."
            ) from None
        return str(best)


def extract_file(data: bytes, file_name: str) -> ExtractedDocument:
    path = PurePosixPath(file_name)
    title = path.stem or file_name
    extension = path.suffix.lower().lstrip(".")
    if extension == "pdf":
        return extract_pdf(data, title)
    if extension == "docx":
        return extract_docx(data, title)
    if extension in ("txt", "md", "markdown"):
        text = _clean(decode_text(data))
        if not text:
            raise PermanentSyncError("This file is empty.")
        return ExtractedDocument(title=title, markdown=text)
    raise PermanentSyncError("Unsupported file type. Upload a PDF, Word (.docx), text or Markdown file.")
