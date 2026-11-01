"""Minimal Supabase Storage client (download + delete) over the REST API."""

from urllib.parse import quote

import httpx

from ingest_worker.config import Settings
from ingest_worker.errors import PermanentSyncError, TransientSyncError

BUCKET = "knowledge-files"


class Storage:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._base = settings.supabase_url.rstrip("/") + "/storage/v1"
        self._headers = {
            "apikey": settings.supabase_secret_key,
            "Authorization": f"Bearer {settings.supabase_secret_key}",
        }
        self._client = client
        self._max_bytes = settings.max_file_bytes

    async def download(self, path: str) -> bytes:
        url = f"{self._base}/object/{BUCKET}/{quote(path)}"
        try:
            response = await self._client.get(url, headers=self._headers, timeout=60.0)
        except httpx.TransportError as error:
            raise TransientSyncError("The uploaded file couldn't be downloaded.") from error
        if response.status_code in (400, 404):
            raise PermanentSyncError("The uploaded file is missing. Upload it again.")
        if response.status_code >= 400:
            raise TransientSyncError("The uploaded file couldn't be downloaded.")
        if len(response.content) > self._max_bytes:
            raise PermanentSyncError("Files can be up to 20 MB.")
        return response.content

    async def delete(self, paths: list[str]) -> None:
        if not paths:
            return
        response = await self._client.request(
            "DELETE",
            f"{self._base}/object/{BUCKET}",
            headers=self._headers,
            json={"prefixes": paths},
            timeout=30.0,
        )
        response.raise_for_status()
