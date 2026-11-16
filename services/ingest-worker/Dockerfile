# syntax=docker/dockerfile:1.7
# Built for linux/arm64 (Graviton Fargate); also builds for amd64.

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

FROM python:3.12-slim
RUN useradd --system --uid 10001 --home /app worker
WORKDIR /app
COPY --from=build --chown=worker:worker /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    HEARTBEAT_PATH=/tmp/ingest-worker-heartbeat
USER worker
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["python", "-m", "ingest_worker.healthcheck"]
# SIGTERM triggers a graceful drain (see main.py); keep the stop timeout above SHUTDOWN_GRACE_SECONDS.
STOPSIGNAL SIGTERM
CMD ["python", "-m", "ingest_worker.main"]
