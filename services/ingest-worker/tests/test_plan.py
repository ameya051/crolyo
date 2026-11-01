from datetime import UTC, datetime

from ingest_worker.chunk import chunk_document
from ingest_worker.plan import PageOutcome, StoredChunk, StoredPage, page_hash, plan_version, with_embeddings

MODEL = "voyageai/voyage-4-large"
NOW = datetime(2026, 11, 1, tzinfo=UTC)
FAQ = "## Shipping\nWe ship to over 40 countries.\n\n## Refunds\nRefunds within 30 days of purchase."


def stored_page(url: str, title: str, markdown: str, *, embedded: bool = True) -> StoredPage:
    page = StoredPage(url, title, '"v1"', None, page_hash(title, markdown), [], None)
    for draft in chunk_document(markdown, title):
        page.chunks.append(
            StoredChunk(
                url,
                draft.title,
                draft.content,
                draft.content_hash,
                f"[{len(page.chunks)}]" if embedded else None,
                MODEL if embedded else None,
            )
        )
    return page


def ok(url: str, title: str, markdown: str) -> PageOutcome:
    return PageOutcome(url, "ok", http_status=200, title=title, markdown=markdown, etag='"v2"')


def test_first_sync_chunks_everything_and_needs_embeddings() -> None:
    plan = plan_version([ok("https://a.com/faq", "FAQ", FAQ)], {}, {}, MODEL, NOW)
    assert len(plan.pages) == 1
    assert len(plan.chunks) == 2
    assert plan.missing_embeddings == [0, 1]
    assert [chunk.chunk_index for chunk in plan.chunks] == [0, 1]


def test_unchanged_page_carries_chunks_and_embeddings_over() -> None:
    previous = {"https://a.com/faq": stored_page("https://a.com/faq", "FAQ", FAQ)}
    plan = plan_version([ok("https://a.com/faq", "FAQ", FAQ)], previous, {}, MODEL, NOW)
    assert plan.reused_pages == 1 and plan.changed_pages == 0
    assert plan.missing_embeddings == []
    assert plan.pages[0].etag == '"v2"'


def test_not_modified_page_is_carried_over_without_refetching_content() -> None:
    previous = {"https://a.com/faq": stored_page("https://a.com/faq", "FAQ", FAQ)}
    plan = plan_version(
        [PageOutcome("https://a.com/faq", "not_modified", http_status=304)], previous, {}, MODEL, NOW
    )
    assert len(plan.chunks) == 2 and plan.missing_embeddings == []
    assert plan.pages[0].last_status == 304
    assert plan.pages[0].etag == '"v1"'


def test_editing_one_paragraph_only_needs_that_chunk_embedded() -> None:
    previous_page = stored_page("https://a.com/faq", "FAQ", FAQ)
    cache = {chunk.content_hash: chunk.embedding for chunk in previous_page.chunks if chunk.embedding}
    edited = FAQ.replace("30 days", "14 days")
    plan = plan_version(
        [ok("https://a.com/faq", "FAQ", edited)], {"https://a.com/faq": previous_page}, cache, MODEL, NOW
    )
    assert plan.changed_pages == 1
    assert len(plan.chunks) == 2
    assert plan.missing_embeddings == [1]  # only the Refunds chunk changed
    assert plan.chunks[0].embedding == previous_page.chunks[0].embedding


def test_gone_pages_are_dropped() -> None:
    previous = {
        "https://a.com/faq": stored_page("https://a.com/faq", "FAQ", FAQ),
        "https://a.com/old": stored_page(
            "https://a.com/old", "Old", "## Old\nThis page was removed from the site."
        ),
    }
    outcomes = [
        ok("https://a.com/faq", "FAQ", FAQ),
        PageOutcome("https://a.com/old", "gone", http_status=404),
    ]
    plan = plan_version(outcomes, previous, {}, MODEL, NOW)
    assert [page.url for page in plan.pages] == ["https://a.com/faq"]
    assert all(chunk.page_url == "https://a.com/faq" for chunk in plan.chunks)


def test_transient_failures_keep_the_previous_copy_marked_stale() -> None:
    previous = {"https://a.com/faq": stored_page("https://a.com/faq", "FAQ", FAQ)}
    plan = plan_version(
        [PageOutcome("https://a.com/faq", "transient", http_status=503)], previous, {}, MODEL, NOW
    )
    assert plan.transient_failures == 1
    assert len(plan.chunks) == 2
    assert plan.pages[0].stale_since == NOW
    assert plan.pages[0].last_status == 503


def test_stale_since_is_preserved_across_repeated_failures() -> None:
    page = stored_page("https://a.com/faq", "FAQ", FAQ)
    earlier = datetime(2026, 10, 30, tzinfo=UTC)
    page.stale_since = earlier
    plan = plan_version(
        [PageOutcome("https://a.com/faq", "transient")], {"https://a.com/faq": page}, {}, MODEL, NOW
    )
    assert plan.pages[0].stale_since == earlier


def test_a_new_page_that_fails_transiently_is_simply_skipped() -> None:
    plan = plan_version([PageOutcome("https://a.com/new", "transient")], {}, {}, MODEL, NOW)
    assert plan.pages == [] and plan.chunks == [] and plan.transient_failures == 1


def test_embedding_model_change_marks_old_vectors_for_reembedding() -> None:
    previous = {"https://a.com/faq": stored_page("https://a.com/faq", "FAQ", FAQ)}
    plan = plan_version(
        [ok("https://a.com/faq", "FAQ", FAQ)], previous, {}, "openai/text-embedding-3-large", NOW
    )
    assert plan.missing_embeddings == [0, 1]
    assert all(chunk.embedding_model is None for chunk in plan.chunks)


def test_non_url_sources_store_no_page_url_on_chunks() -> None:
    plan = plan_version([ok("file:guide.pdf", "guide", FAQ)], {}, {}, MODEL, NOW, chunk_page_urls=False)
    assert all(chunk.page_url is None for chunk in plan.chunks)


def test_with_embeddings_fills_only_the_given_indices() -> None:
    plan = plan_version([ok("https://a.com/faq", "FAQ", FAQ)], {}, {}, MODEL, NOW)
    filled = with_embeddings(plan, {1: "[1,2,3,4]"}, MODEL)
    assert filled.chunks[0].embedding is None
    assert filled.chunks[1].embedding == "[1,2,3,4]"
    assert filled.missing_embeddings == [0]
