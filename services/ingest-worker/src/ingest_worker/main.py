"""Worker entrypoint: claims jobs from Postgres (LISTEN/NOTIFY + polling),
runs them with bounded concurrency, schedules re-crawls and drains on SIGTERM."""

import asyncio
import contextlib
import signal
from pathlib import Path

import httpx
from psycopg import AsyncConnection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import AsyncConnectionPool

from ingest_worker import db
from ingest_worker.config import Settings
from ingest_worker.embed import Embedder
from ingest_worker.errors import SyncError
from ingest_worker.logging_setup import configure_logging, log
from ingest_worker.pipeline import Deps, sync_source
from ingest_worker.storage import Storage

CHANNEL = "knowledge_jobs"


class Worker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.pool: AsyncConnectionPool[db.Conn] = AsyncConnectionPool(
            settings.database_url,
            min_size=1,
            max_size=settings.worker_concurrency + 2,
            kwargs={"autocommit": True, "row_factory": dict_row},
            connection_class=AsyncConnection[DictRow],
            open=False,
        )
        self.http = httpx.AsyncClient(http2=False, headers={"Accept-Encoding": "gzip, deflate"})
        self.deps = Deps(settings, self.http, Embedder(settings, self.http), Storage(settings, self.http))
        self.wake = asyncio.Event()
        self.stopping = asyncio.Event()
        self.running: dict[asyncio.Task[None], db.Job] = {}

    def heartbeat(self) -> None:
        Path(self.settings.heartbeat_path).touch()

    async def listen(self) -> None:
        """Wakes the claim loop as soon as a job is enqueued."""
        delay = 1.0
        while not self.stopping.is_set():
            try:
                async with await AsyncConnection.connect(self.settings.database_url, autocommit=True) as conn:
                    await conn.execute(f"LISTEN {CHANNEL}")
                    log.info("worker.listen.connected")
                    delay = 1.0
                    while not self.stopping.is_set():
                        async for _ in conn.notifies(timeout=5.0):
                            self.wake.set()
            except Exception as error:  # keep listening through DB restarts
                log.warning("worker.listen.disconnected", error=type(error).__name__)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30.0)

    async def schedule(self) -> None:
        while not self.stopping.is_set():
            try:
                async with self.pool.connection() as conn:
                    queued = await db.enqueue_due_syncs(conn)
                if queued:
                    log.info("worker.schedule.enqueued", count=queued)
            except Exception as error:
                log.error("worker.schedule.failed", error=type(error).__name__)
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self.stopping.wait(), self.settings.schedule_interval_seconds)

    async def keep_lease(self, job: db.Job) -> None:
        while True:
            await asyncio.sleep(self.settings.lease_renew_seconds)
            async with self.pool.connection() as conn:
                if not await db.renew_lease(
                    conn, job.id, self.settings.worker_id, self.settings.lease_seconds
                ):
                    log.warning("worker.lease.lost", job_id=str(job.id))
                    return

    async def run_job(self, job: db.Job) -> None:
        settings = self.settings
        lease = asyncio.create_task(self.keep_lease(job))
        try:
            async with self.pool.connection() as conn:
                try:
                    await sync_source(
                        self.deps, conn, job, final_attempt=job.attempts >= settings.max_attempts
                    )
                except SyncError as error:
                    retry = await db.fail_job(
                        conn,
                        job,
                        settings.worker_id,
                        error.user_message,
                        retryable=error.retryable,
                        max_attempts=settings.max_attempts,
                    )
                    log.warning(
                        "job.failed",
                        job_id=str(job.id),
                        source_id=str(job.source_id),
                        retryable=error.retryable,
                        will_retry=retry,
                        reason=error.user_message,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    log.exception("job.crashed", job_id=str(job.id), source_id=str(job.source_id))
                    retry = await db.fail_job(
                        conn,
                        job,
                        settings.worker_id,
                        "Something went wrong while syncing. We'll try again.",
                        retryable=True,
                        max_attempts=settings.max_attempts,
                    )
                    log.warning("job.failed", job_id=str(job.id), will_retry=retry)
                else:
                    await db.complete_job(conn, job, settings.worker_id)
                    log.info("job.completed", job_id=str(job.id), source_id=str(job.source_id))
        finally:
            lease.cancel()
            self.wake.set()  # free slot: try to claim more

    async def claim_available(self) -> None:
        while len(self.running) < self.settings.worker_concurrency and not self.stopping.is_set():
            async with self.pool.connection() as conn:
                job = await db.claim_job(
                    conn, self.settings.worker_id, self.settings.lease_seconds, self.settings.max_attempts
                )
            if job is None:
                return
            log.info("job.claimed", job_id=str(job.id), source_id=str(job.source_id), attempt=job.attempts)
            task = asyncio.create_task(self.run_job(job))
            self.running[task] = job
            task.add_done_callback(self.running.pop)

    async def run(self) -> None:
        await self.pool.open(wait=True)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self.stopping.set)

        background = [asyncio.create_task(self.listen()), asyncio.create_task(self.schedule())]
        log.info(
            "worker.started", worker_id=self.settings.worker_id, concurrency=self.settings.worker_concurrency
        )
        try:
            while not self.stopping.is_set():
                self.heartbeat()
                try:
                    await self.claim_available()
                except Exception as error:
                    log.error("worker.claim.failed", error=type(error).__name__)
                self.wake.clear()
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(self._wait_for_wake(), self.settings.poll_interval_seconds)
        finally:
            await self.shutdown(background)

    async def _wait_for_wake(self) -> None:
        wake = asyncio.create_task(self.wake.wait())
        stop = asyncio.create_task(self.stopping.wait())
        try:
            await asyncio.wait({wake, stop}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            wake.cancel()
            stop.cancel()

    async def shutdown(self, background: list[asyncio.Task[None]]) -> None:
        log.info("worker.stopping", running=len(self.running))
        if self.running:
            _, pending = await asyncio.wait(set(self.running), timeout=self.settings.shutdown_grace_seconds)
            jobs = [self.running[task] for task in pending if task in self.running]
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            async with self.pool.connection() as conn:
                for job in jobs:
                    await db.release_job(conn, job, self.settings.worker_id)
                    log.info("job.released", job_id=str(job.id))
        for task in background:
            task.cancel()
        await asyncio.gather(*background, return_exceptions=True)
        await self.http.aclose()
        await self.pool.close()
        log.info("worker.stopped")


def run() -> None:
    settings = Settings()  # type: ignore[call-arg]  # values come from the environment
    configure_logging(settings.log_level)
    asyncio.run(Worker(settings).run())


if __name__ == "__main__":
    run()
