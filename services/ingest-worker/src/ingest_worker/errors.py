class SyncError(Exception):
    """A sync failure with a message that is safe to show the site owner.

    `retryable` failures (network trouble, provider outages) are retried with
    backoff; the rest fail the job immediately.
    """

    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.user_message = message
        self.retryable = retryable


class PermanentSyncError(SyncError):
    def __init__(self, message: str) -> None:
        super().__init__(message, retryable=False)


class TransientSyncError(SyncError):
    def __init__(self, message: str) -> None:
        super().__init__(message, retryable=True)
