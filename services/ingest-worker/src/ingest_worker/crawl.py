"""Fetches a URL source's pages (one page, or a same-site BFS crawl)."""

import asyncio

import httpx

from ingest_worker.errors import PermanentSyncError
from ingest_worker.extract_file import decode_text
from ingest_worker.extract_html import extract_html, normalize_url, same_site
from ingest_worker.logging_setup import log
from ingest_worker.plan import PageOutcome, StoredPage
from ingest_worker.safe_fetch import FetchResult, ResponseTooLargeError, UnsafeUrlError, safe_get

USER_AGENT = "CrolyoBot/1.0 (+https://crolyo.com/bot; knowledge base sync)"
HTML_TYPES = {"text/html", "application/xhtml+xml"}
TRANSIENT_STATUS = {408, 425, 429}
GONE_STATUS = {404, 410}


def _decode(result: FetchResult) -> str:
    if result.charset:
        try:
            return result.body.decode(result.charset, errors="replace")
        except LookupError:
            pass
    return decode_text(result.body)


async def fetch_page(
    client: httpx.AsyncClient,
    url: str,
    previous: StoredPage | None,
    *,
    is_start: bool,
    request_timeout: float,
    max_bytes: int,
) -> PageOutcome:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8"}
    if previous is not None:
        if previous.etag:
            headers["If-None-Match"] = previous.etag
        if previous.last_modified:
            headers["If-Modified-Since"] = previous.last_modified

    try:
        result = await safe_get(
            client, url, headers=headers, max_bytes=max_bytes, request_timeout=request_timeout
        )
    except UnsafeUrlError as error:
        if is_start:
            raise PermanentSyncError(str(error)) from error
        return PageOutcome(url, "gone")
    except ResponseTooLargeError as error:
        if is_start:
            raise PermanentSyncError("That page is too large to import (over 3 MB).") from error
        return PageOutcome(url, "gone")
    except (httpx.TimeoutException, httpx.TransportError):
        return PageOutcome(url, "transient")

    status = result.status
    if status == 304:
        return PageOutcome(
            url,
            "not_modified" if previous else "transient",
            http_status=304,
            etag=result.headers.get("etag"),
            last_modified=result.headers.get("last-modified"),
        )
    if status in TRANSIENT_STATUS or status >= 500:
        return PageOutcome(url, "transient", http_status=status)
    if status in GONE_STATUS:
        return PageOutcome(url, "gone", http_status=status)
    if status >= 400:
        if is_start and previous is None:
            raise PermanentSyncError(
                f"The site refused our request (HTTP {status}). Make sure the page is public."
            )
        return PageOutcome(url, "gone", http_status=status)
    if status != 200:
        return PageOutcome(url, "gone", http_status=status)

    content_type = result.content_type
    if content_type in HTML_TYPES or (not content_type and result.body.lstrip()[:1] == b"<"):
        page = extract_html(_decode(result), result.final_url)
        title, markdown, links = page.title, page.markdown, page.links
    elif content_type == "text/plain":
        title, markdown, links = "", _decode(result).strip(), []
    else:
        if is_start:
            raise PermanentSyncError("That link isn't a web page. Upload documents as files instead.")
        return PageOutcome(url, "gone", http_status=status)

    return PageOutcome(
        url,
        "ok",
        http_status=200,
        title=title or url,
        markdown=markdown,
        etag=result.headers.get("etag"),
        last_modified=result.headers.get("last-modified"),
        links=links,
    )


async def crawl(
    client: httpx.AsyncClient,
    start_url: str,
    previous: dict[str, StoredPage],
    *,
    follow_links: bool,
    max_pages: int,
    concurrency: int,
    request_timeout: float,
    max_bytes: int,
) -> list[PageOutcome]:
    start = normalize_url(start_url)
    limit = max_pages if follow_links else 1
    queue: list[str] = [start]
    seen: set[str] = {start}
    outcomes: list[PageOutcome] = []
    semaphore = asyncio.Semaphore(concurrency)

    async def fetch(url: str) -> PageOutcome:
        async with semaphore:
            return await fetch_page(
                client,
                url,
                previous.get(url),
                is_start=url == start,
                request_timeout=request_timeout,
                max_bytes=max_bytes,
            )

    while queue and len(outcomes) < limit:
        batch, queue = queue[: limit - len(outcomes)], queue[limit - len(outcomes) :]
        for outcome in await asyncio.gather(*(fetch(url) for url in batch)):
            outcomes.append(outcome)
            if not follow_links:
                continue
            # Follow links even through unchanged/unreachable pages (from the last copy).
            prev = previous.get(outcome.url)
            links = outcome.links if outcome.kind == "ok" else (prev.links if prev else [])
            for link in links:
                if link not in seen and same_site(link, start):
                    seen.add(link)
                    queue.append(link)

    log.info(
        "crawl.completed",
        pages=len(outcomes),
        ok=sum(o.kind == "ok" for o in outcomes),
        not_modified=sum(o.kind == "not_modified" for o in outcomes),
        gone=sum(o.kind == "gone" for o in outcomes),
        transient=sum(o.kind == "transient" for o in outcomes),
    )
    return outcomes
