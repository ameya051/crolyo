import io

import pytest

from ingest_worker.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="postgresql://unused",
        supabase_url="https://project.supabase.co",
        supabase_secret_key="sb_secret_test",
        openrouter_api_key="or-test-key",
        embedding_dimensions=4,
        embedding_batch_size=2,
    )


def make_pdf(pages: list[str]) -> bytes:
    """Builds a minimal valid PDF with one line of Helvetica text per page
    (an empty string makes a page with no text layer, like a scan)."""
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    pages_index = add(b"")  # placeholder, filled after the page objects exist
    page_refs: list[int] = []
    for text in pages:
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode() if text else b""
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_refs.append(
            add(
                b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R "
                b"/Resources << /Font << /F1 %d 0 R >> >> >>" % (pages_index, content, font)
            )
        )
    kids = b" ".join(b"%d 0 R" % ref for ref in page_refs)
    objects[pages_index - 1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(page_refs))
    catalog = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_index)

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % number + body + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1))
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(
        b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, catalog, xref)
    )
    return out.getvalue()
