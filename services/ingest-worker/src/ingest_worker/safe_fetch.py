"""SSRF-safe HTTP GET for user-supplied URLs.

Every hop (including redirects) must resolve only to public addresses. This
blocks loopback, private ranges, link-local (169.254.169.254 EC2 metadata,
169.254.170.2 ECS task metadata), CGNAT, multicast and reserved space.

Known limit: httpx resolves the hostname again when connecting, so a DNS
rebinding attacker could race the check. The network layer (no private
routes from the task's subnet) is the second line of defense.
"""

import asyncio
import ipaddress
import socket
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import httpx

MAX_REDIRECTS = 5
ALLOWED_PORTS = {80, 443, 8080, 8443}
REDIRECT_CODES = {301, 302, 303, 307, 308}


class UnsafeUrlError(Exception):
    """The URL (or a redirect target) isn't allowed."""


class ResponseTooLargeError(Exception):
    pass


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").split(";")[0].strip().lower()

    @property
    def charset(self) -> str | None:
        for part in self.headers.get("content-type", "").split(";")[1:]:
            key, _, value = part.strip().partition("=")
            if key.lower() == "charset" and value:
                return value.strip("\"'")
        return None


def is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return bool(
        ip.is_global
        and not ip.is_multicast
        and not ip.is_reserved
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_private
        and not ip.is_unspecified
    )


async def resolve_addresses(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [str(info[4][0]) for info in infos]


def _parse_target(url: str) -> tuple[str, int]:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http and https links are supported.")
    if not parts.hostname:
        raise UnsafeUrlError("The link has no host name.")
    if parts.username or parts.password:
        raise UnsafeUrlError("Links with embedded credentials aren't supported.")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise UnsafeUrlError("That port isn't allowed.")
    return parts.hostname, port


async def assert_public_destination(url: str) -> None:
    host, port = _parse_target(url)
    try:
        addresses = await resolve_addresses(host, port)
    except OSError as error:
        raise UnsafeUrlError("The site's address couldn't be found.") from error
    if not addresses or not all(is_public_ip(address) for address in addresses):
        raise UnsafeUrlError("That address isn't publicly reachable.")


async def safe_get(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    max_bytes: int,
    request_timeout: float,
) -> FetchResult:
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        await assert_public_destination(current)
        request = client.build_request("GET", current, headers=headers, timeout=request_timeout)
        response = await client.send(request, stream=True, follow_redirects=False)
        try:
            if response.status_code in REDIRECT_CODES:
                location = response.headers.get("location")
                if not location:
                    return FetchResult(url, current, response.status_code, dict(response.headers))
                current = urljoin(current, location)
                continue

            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise ResponseTooLargeError()
            chunks: list[bytes] = []
            received = 0
            async for chunk in response.aiter_bytes():
                received += len(chunk)
                if received > max_bytes:
                    raise ResponseTooLargeError()
                chunks.append(chunk)
            return FetchResult(url, current, response.status_code, dict(response.headers), b"".join(chunks))
        finally:
            await response.aclose()
    raise UnsafeUrlError("The link redirected too many times.")
