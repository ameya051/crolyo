import json

import httpx
import pytest
import respx

from ingest_worker import embed
from ingest_worker.config import Settings
from ingest_worker.embed import Embedder, to_pgvector
from ingest_worker.errors import PermanentSyncError, TransientSyncError

URL = "https://openrouter.ai/api/v1/embeddings"


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    async def instant(_: float) -> None:
        return None

    monkeypatch.setattr(embed.asyncio, "sleep", instant)


def vectors(count: int, dims: int = 4, offset: int = 0) -> dict[str, object]:
    return {"data": [{"index": i, "embedding": [float(offset + i)] * dims} for i in range(count)]}


@respx.mock
async def test_batches_requests_and_preserves_order(settings: Settings) -> None:
    calls: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append(body)
        data = vectors(len(body["input"]), offset=len(calls) * 10)["data"]
        return httpx.Response(200, json={"data": list(reversed(data))})  # out of order on purpose

    respx.post(URL).mock(side_effect=handler)
    async with httpx.AsyncClient() as client:
        result = await Embedder(settings, client).embed_documents(["a", "b", "c"])

    assert len(calls) == 2  # batch size 2
    assert calls[0]["input_type"] == "search_document"
    assert calls[0]["model"] == settings.embedding_model
    assert result[0] == to_pgvector([10.0] * 4) and result[1] == to_pgvector([11.0] * 4)
    assert result[2] == to_pgvector([20.0] * 4)


@respx.mock
async def test_retries_rate_limits_then_succeeds(settings: Settings) -> None:
    route = respx.post(URL).mock(
        side_effect=[httpx.Response(429), httpx.Response(503), httpx.Response(200, json=vectors(1))]
    )
    async with httpx.AsyncClient() as client:
        result = await Embedder(settings, client).embed_documents(["a"])
    assert route.call_count == 3
    assert len(result) == 1


@respx.mock
async def test_gives_up_after_retries_with_a_transient_error(settings: Settings) -> None:
    respx.post(URL).mock(return_value=httpx.Response(502))
    async with httpx.AsyncClient() as client:
        with pytest.raises(TransientSyncError):
            await Embedder(settings, client).embed_documents(["a"])


@respx.mock
async def test_dimension_mismatch_is_a_configuration_error(settings: Settings) -> None:
    respx.post(URL).mock(return_value=httpx.Response(200, json=vectors(1, dims=8)))
    async with httpx.AsyncClient() as client:
        with pytest.raises(PermanentSyncError, match="configuration"):
            await Embedder(settings, client).embed_documents(["a"])


def test_pgvector_text_form() -> None:
    assert to_pgvector([1, 0.5, -2]) == "[1.0,0.5,-2.0]"
