"""Container health check: healthy while the main loop keeps touching its heartbeat file."""

import os
import sys
import time

MAX_AGE_SECONDS = 120


def main() -> int:
    path = os.environ.get("HEARTBEAT_PATH", "/tmp/ingest-worker-heartbeat")  # noqa: S108
    try:
        age = time.time() - os.path.getmtime(path)
    except OSError:
        return 1
    return 0 if age <= MAX_AGE_SECONDS else 1


if __name__ == "__main__":
    sys.exit(main())
