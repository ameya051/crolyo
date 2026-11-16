import httpx
import pytest
import respx

from ingest_worker import safe_fetch
from ingest_worker.crawl import crawl
from ingest_worker.errors import PermanentSyncError
from ingest_worker.plan import StoredPage


@pytest.fixture(autouse=True)
def public_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    async def resolve(host: str, port: int) -> list[str]:
        return ["93.184.216.34"]

    monkeypatch.setattr(safe_fetch, "resolve_addresses", resolve)


def html(title: str, body: str, links: list[str] | None = None) -> str:
    anchors = "".join(f'<a href="{href}">link</a> ' for href in links or [])
    return (
        f"<html><head><title>{title}</title></head><body><main><article><h1>{title}</h1>"
        f"<p>{body}</p><p>{anchors}</p></article></main></body></html>"
    )


async def run(
    start: str, previous: dict[str, StoredPage] | None = None, follow: bool = True, max_pages: int = 20
):
    async with httpx.AsyncClient() as client:
        return await crawl(
            client,
            start,
            previous or {},
            follow_links=follow,
            max_pages=max_pages,
            concurrency=3,
            request_timeout=5,
            max_bytes=1_000_000,
        )


LONG = "This paragraph has enough words to count as the main content of the page for extraction purposes."


@respx.mock
async def test_crawl_follows_same_site_links_and_classifies_outcomes() -> None:
    respx.get("https://acme.com/help").mock(
        return_value=httpx.Response(
            200, html=html("Help", LONG, ["/a", "/missing", "/down", "https://other.com/x"])
        )
    )
    respx.get("https://acme.com/a").mock(return_value=httpx.Response(200, html=html("A", LONG)))
    respx.get("https://acme.com/missing").mock(return_value=httpx.Response(404))
    respx.get("https://acme.com/down").mock(return_value=httpx.Response(503))
    other = respx.get("https://other.com/x").mock(return_value=httpx.Response(200))

    outcomes = {outcome.url: outcome.kind for outcome in await run("https://acme.com/help")}
    assert outcomes == {
        "https://acme.com/help": "ok",
        "https://acme.com/a": "ok",
        "https://acme.com/missing": "gone",
        "https://acme.com/down": "transient",
    }
    assert not other.called


@respx.mock
async def test_single_page_mode_does_not_follow_links() -> None:
    respx.get("https://acme.com/help").mock(return_value=httpx.Response(200, html=html("Help", LONG, ["/a"])))
    a = respx.get("https://acme.com/a").mock(return_value=httpx.Response(200))
    outcomes = await run("https://acme.com/help", follow=False)
    assert [outcome.url for outcome in outcomes] == ["https://acme.com/help"]
    assert not a.called


@respx.mock
async def test_page_cap_is_respected() -> None:
    links = [f"/p{index}" for index in range(30)]
    respx.get("https://acme.com/").mock(return_value=httpx.Response(200, html=html("Home", LONG, links)))
    respx.get(url__regex=r"https://acme\.com/p\d+").mock(
        return_value=httpx.Response(200, html=html("P", LONG))
    )
    outcomes = await run("https://acme.com/", max_pages=5)
    assert len(outcomes) == 5


@respx.mock
async def test_conditional_requests_and_crawling_through_unchanged_pages() -> None:
    previous = {
        "https://acme.com/help": StoredPage(
            "https://acme.com/help", "Help", '"abc"', None, "h", ["https://acme.com/a"], None
        ),
    }
    help_route = respx.get("https://acme.com/help").mock(return_value=httpx.Response(304))
    respx.get("https://acme.com/a").mock(return_value=httpx.Response(200, html=html("A", LONG)))

    outcomes = {outcome.url: outcome.kind for outcome in await run("https://acme.com/help", previous)}
    assert help_route.calls.last.request.headers["if-none-match"] == '"abc"'
    # Links stored from the last copy keep the crawl going past a 304.
    assert outcomes == {"https://acme.com/help": "not_modified", "https://acme.com/a": "ok"}


@respx.mock
async def test_start_page_errors_fail_the_sync_with_a_clear_message() -> None:
    respx.get("https://acme.com/private").mock(return_value=httpx.Response(403))
    with pytest.raises(PermanentSyncError, match="HTTP 403"):
        await run("https://acme.com/private")

    respx.get("https://acme.com/file.bin").mock(
        return_value=httpx.Response(
            200, content=b"\x00\x01", headers={"content-type": "application/octet-stream"}
        )
    )
    with pytest.raises(PermanentSyncError, match="isn't a web page"):
        await run("https://acme.com/file.bin")


@respx.mock
async def test_network_errors_are_transient() -> None:
    respx.get("https://acme.com/slow").mock(side_effect=httpx.ConnectTimeout("timeout"))
    outcomes = await run("https://acme.com/slow")
    assert outcomes[0].kind == "transient"
