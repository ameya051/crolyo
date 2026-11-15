import httpx
import pytest
import respx

from ingest_worker import safe_fetch
from ingest_worker.safe_fetch import ResponseTooLargeError, UnsafeUrlError, is_public_ip, safe_get

DNS = {
    "public.example": ["93.184.216.34"],
    "internal.example": ["10.0.0.5"],
    "mixed.example": ["93.184.216.34", "127.0.0.1"],
    "metadata.example": ["169.254.169.254"],
}


@pytest.fixture(autouse=True)
def fake_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    async def resolve(host: str, port: int) -> list[str]:
        if host in DNS:
            return DNS[host]
        if is_public_ip(host) or host.replace(".", "").isdigit() or ":" in host:
            return [host]
        raise OSError("not found")

    monkeypatch.setattr(safe_fetch, "resolve_addresses", resolve)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.1.2.3",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "169.254.170.2",
        "100.64.0.1",
        "0.0.0.0",
        "::1",
        "fe80::1",
        "fc00::1",
        "::ffff:127.0.0.1",
        "224.0.0.1",
    ],
)
def test_non_public_addresses_are_rejected(address: str) -> None:
    assert not is_public_ip(address)


def test_public_addresses_are_allowed() -> None:
    assert is_public_ip("93.184.216.34")
    assert is_public_ip("2606:2800:220:1:248:1893:25c8:1946")


async def fetch(url: str) -> safe_fetch.FetchResult:
    async with httpx.AsyncClient() as client:
        return await safe_get(client, url, max_bytes=1024, request_timeout=5)


@pytest.mark.parametrize(
    "url",
    [
        "http://internal.example/",
        "http://mixed.example/",
        "http://metadata.example/latest/meta-data/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://169.254.170.2/v2/credentials",
        "ftp://public.example/",
        "http://user:pass@public.example/",
        "http://public.example:22/",
        "http://nope.example/",
    ],
)
async def test_unsafe_urls_are_blocked_before_any_request(url: str) -> None:
    with respx.mock(assert_all_called=False) as router:
        route = router.route().mock(return_value=httpx.Response(200))
        with pytest.raises(UnsafeUrlError):
            await fetch(url)
        assert not route.called


@respx.mock
async def test_redirects_are_followed_and_each_hop_is_checked() -> None:
    respx.get("http://public.example/a").mock(return_value=httpx.Response(302, headers={"location": "/b"}))
    respx.get("http://public.example/b").mock(return_value=httpx.Response(200, text="hello"))
    result = await fetch("http://public.example/a")
    assert result.status == 200
    assert result.final_url == "http://public.example/b"
    assert result.body == b"hello"


@respx.mock
async def test_redirect_to_a_private_address_is_blocked() -> None:
    respx.get("http://public.example/a").mock(
        return_value=httpx.Response(302, headers={"location": "http://metadata.example/latest/"})
    )
    with pytest.raises(UnsafeUrlError):
        await fetch("http://public.example/a")


@respx.mock
async def test_redirect_loops_are_cut_off() -> None:
    respx.get("http://public.example/loop").mock(
        return_value=httpx.Response(302, headers={"location": "/loop"})
    )
    with pytest.raises(UnsafeUrlError, match="too many"):
        await fetch("http://public.example/loop")


@respx.mock
async def test_oversized_bodies_are_rejected() -> None:
    respx.get("http://public.example/big").mock(return_value=httpx.Response(200, content=b"x" * 2048))
    with pytest.raises(ResponseTooLargeError):
        await fetch("http://public.example/big")
