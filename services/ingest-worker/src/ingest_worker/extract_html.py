"""Main-content extraction for web pages (trafilatura) plus link discovery."""

import re
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import lxml.html
import trafilatura

SKIP_EXTENSIONS = re.compile(
    r"\.(?:pdf|jpe?g|png|gif|svg|webp|ico|zip|gz|tar|mp3|mp4|mov|avi|webm|css|js|json|xml|rss|woff2?|ttf|docx?|xlsx?|pptx?)$",
    re.IGNORECASE,
)
TRACKING_PARAM = re.compile(r"^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$)", re.IGNORECASE)


@dataclass
class HtmlPage:
    title: str
    markdown: str
    links: list[str]


def normalize_url(url: str) -> str:
    """Canonical form used as the page key: no fragment, no tracking params, no trailing slash."""
    parts = urlsplit(url.strip())
    query = urlencode(
        [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not TRACKING_PARAM.match(k)]
    )
    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), (parts.netloc or "").lower(), path, query, ""))


def site_key(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def same_site(url: str, other: str) -> bool:
    return site_key(url) == site_key(other)


def extract_links(html: str, base_url: str) -> list[str]:
    try:
        document = lxml.html.fromstring(html)
    except (ValueError, lxml.etree.ParserError):
        return []
    links: list[str] = []
    seen: set[str] = set()
    for href in document.xpath("//a/@href"):
        href = str(href).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue
        absolute = urljoin(base_url, href)
        if urlsplit(absolute).scheme not in ("http", "https"):
            continue
        if SKIP_EXTENSIONS.search(urlsplit(absolute).path):
            continue
        normalized = normalize_url(absolute)
        if normalized not in seen:
            seen.add(normalized)
            links.append(normalized)
    return links


def _fallback_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""


def extract_html(html: str, url: str) -> HtmlPage:
    markdown = (
        trafilatura.extract(
            html,
            url=url,
            output_format="markdown",
            include_tables=True,
            include_links=False,
            include_images=False,
            include_comments=False,
            favor_recall=True,
            deduplicate=True,
        )
        or ""
    )
    metadata = trafilatura.extract_metadata(html, default_url=url)
    title = (metadata.title if metadata and metadata.title else "") or _fallback_title(html)
    return HtmlPage(title=title.strip()[:300], markdown=markdown.strip(), links=extract_links(html, url))
