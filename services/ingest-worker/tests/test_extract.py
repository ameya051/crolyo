import io

import pytest
from docx import Document

from ingest_worker.errors import PermanentSyncError
from ingest_worker.extract_file import extract_file
from ingest_worker.extract_html import extract_html, normalize_url, same_site
from tests.conftest import make_pdf

PAGE = """<!doctype html>
<html><head><title>Help Center | Acme</title><script>var tracking = 1;</script></head>
<body>
  <nav><a href="/">Home</a> <a href="/pricing">Pricing</a> Navigation menu items</nav>
  <div class="cookie-banner">We use cookies to improve your experience.</div>
  <main>
    <article>
      <h1>Shipping policy</h1>
      <p>We ship to over 40 countries. Orders leave our warehouse within two business days of purchase.</p>
      <h2>International orders</h2>
      <p>International delivery usually takes five to ten business days depending on customs processing.</p>
      <p>Read more about <a href="/returns#window">returns</a>
         or <a href="https://acme.com/faq?utm_source=x">our FAQ</a>.</p>
      <p><a href="/manual.pdf">Manual</a> <a href="mailto:hi@acme.com">Email</a> <a href="https://other.com/x">Other</a></p>
    </article>
  </main>
  <footer>Copyright Acme Inc. All rights reserved.</footer>
</body></html>"""


def test_html_extraction_keeps_main_content_and_headings() -> None:
    page = extract_html(PAGE, "https://www.acme.com/help/shipping")
    assert "We ship to over 40 countries" in page.markdown
    assert "International orders" in page.markdown
    assert "var tracking" not in page.markdown
    assert "All rights reserved" not in page.markdown
    assert page.title


def test_html_links_are_normalized_and_filtered() -> None:
    page = extract_html(PAGE, "https://www.acme.com/help/shipping")
    assert "https://www.acme.com/returns" in page.links  # fragment dropped
    assert "https://acme.com/faq" in page.links  # tracking param dropped
    assert not any(link.endswith(".pdf") for link in page.links)
    assert not any(link.startswith("mailto:") for link in page.links)


def test_url_normalization_and_same_site() -> None:
    assert normalize_url("HTTPS://Acme.com/Docs/#top") == "https://acme.com/Docs"
    assert normalize_url("https://acme.com/?utm_medium=a&page=2") == "https://acme.com/?page=2"
    assert same_site("https://www.acme.com/a", "https://acme.com/b")
    assert not same_site("https://docs.acme.com/a", "https://acme.com/b")


def test_pdf_text_is_extracted_per_page() -> None:
    data = make_pdf(
        [
            "Refunds are available within thirty days of purchase.",
            "Shipping takes five business days worldwide.",
        ]
    )
    document = extract_file(data, "Policies.pdf")
    assert document.title == "Policies"
    assert "## Page 1" in document.markdown and "## Page 2" in document.markdown
    assert "thirty days" in document.markdown
    assert "five business days" in document.markdown


def test_scanned_pdf_without_text_is_rejected_clearly() -> None:
    with pytest.raises(PermanentSyncError, match="no selectable text"):
        extract_file(make_pdf(["", ""]), "scan.pdf")


def test_damaged_pdf_is_rejected_clearly() -> None:
    with pytest.raises(PermanentSyncError, match="couldn't be opened"):
        extract_file(b"%PDF-1.4 not really a pdf", "broken.pdf")


def test_docx_headings_lists_and_tables_become_markdown() -> None:
    document = Document()
    document.add_heading("Plans", level=1)
    document.add_paragraph("Pick the plan that fits your team.")
    document.add_paragraph("Unlimited chats", style="List Bullet")
    table = document.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Plan"
    table.rows[0].cells[1].text = "Price"
    table.rows[1].cells[0].text = "Pro"
    table.rows[1].cells[1].text = "$29"
    buffer = io.BytesIO()
    document.save(buffer)

    extracted = extract_file(buffer.getvalue(), "pricing.docx")
    assert "# Plans" in extracted.markdown
    assert "- Unlimited chats" in extracted.markdown
    assert "| Plan | Price |" in extracted.markdown
    assert "| Pro | $29 |" in extracted.markdown


def test_text_files_in_other_encodings_are_decoded() -> None:
    data = "Café opening hours: 9am to 5pm, Monday to Friday. Déjà vu.".encode("latin-1")
    assert "Café" in extract_file(data, "hours.txt").markdown
    assert extract_file(b"# Title\n\nBody text", "notes.md").markdown.startswith("# Title")


def test_unsupported_and_empty_files_are_rejected() -> None:
    with pytest.raises(PermanentSyncError, match="Unsupported"):
        extract_file(b"data", "sheet.xlsx")
    with pytest.raises(PermanentSyncError, match="empty"):
        extract_file(b"   \n ", "empty.txt")
