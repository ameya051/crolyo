from ingest_worker.chunk import (
    CHUNK_TOKENS,
    chunk_document,
    content_hash,
    count_tokens,
    split_sections,
)


def test_whitespace_and_unicode_form_changes_keep_the_same_hash() -> None:
    assert content_hash("Shipping", "We ship  worldwide.\n\nFast.") == content_hash(
        "Shipping", "We ship worldwide. Fast."
    )
    # NFKC: a non-breaking space and a ligature normalize to the plain forms.
    assert content_hash("Shipping", "We ship\u00a0worldwide") == content_hash("Shipping", "We ship worldwide")
    assert content_hash("A", "\ufb01ne") == content_hash("A", "fine")


def test_real_edits_change_the_hash() -> None:
    assert content_hash("Refunds", "Refunds within 30 days.") != content_hash(
        "Refunds", "Refunds within 14 days."
    )
    assert content_hash("Refunds", "x") != content_hash("Returns", "x")


def test_split_sections_tracks_heading_paths_and_ignores_fenced_code() -> None:
    markdown = "\n".join(
        [
            "# Help",
            "Intro text.",
            "## Shipping",
            "We ship worldwide.",
            "```",
            "# not a heading",
            "```",
            "### Canada",
            "Yes, 5 days.",
            "## Returns",
            "30 days.",
        ]
    )
    sections = split_sections(markdown)
    assert [section.path for section in sections] == [
        ["Help"],
        ["Help", "Shipping"],
        ["Help", "Shipping", "Canada"],
        ["Help", "Returns"],
    ]
    assert "# not a heading" in sections[1].body


def test_chunk_titles_carry_the_heading_path_without_repeating_the_doc_title() -> None:
    chunks = chunk_document("# Help\n## Shipping\nWe ship to over 40 countries.", "Help")
    assert [chunk.title for chunk in chunks] == ["Help > Shipping"]


def test_short_answers_under_a_descriptive_heading_are_kept() -> None:
    chunks = chunk_document("## Do you ship to Canada?\nYes.", "FAQ")
    assert len(chunks) == 1
    assert chunks[0].content == "Yes."
    assert chunks[0].embedding_input.startswith("FAQ > Do you ship to Canada?")


def test_long_sections_are_split_within_the_token_budget_with_overlap() -> None:
    body = " ".join(f"Sentence number {index} talks about our refund policy." for index in range(400))
    chunks = chunk_document(f"## Refunds\n{body}", "Policies")
    assert len(chunks) > 3
    assert all(count_tokens(chunk.content) <= CHUNK_TOKENS for chunk in chunks)
    # Overlap: consecutive chunks share some text.
    assert any(chunks[i].content[-40:] in chunks[i + 1].content for i in range(len(chunks) - 1)) or any(
        set(chunks[i].content.split()[-8:]) & set(chunks[i + 1].content.split()[:30])
        for i in range(len(chunks) - 1)
    )


def test_unchanged_text_produces_identical_hashes() -> None:
    first = chunk_document("## A\nAlpha text here.\n## B\nBeta text here.", "Doc")
    second = chunk_document("## A\nAlpha  text here.\n\n\n## B\nBeta text here.  ", "Doc")
    assert [chunk.content_hash for chunk in first] == [chunk.content_hash for chunk in second]
