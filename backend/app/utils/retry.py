import asyncio
import logging

import structlog
from httpx import HTTPStatusError, TimeoutException
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = structlog.get_logger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS_CODES
    if isinstance(exc, TimeoutException):
        return True
    return False


def retry_external_api(
    max_attempts: int = 3,
    wait_min: float = 1.0,
    wait_max: float = 60.0,
):
    """Decorator factory that wraps an async function with retry logic for external API calls."""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(max_attempts),
                wait=wait_exponential_jitter(initial=wait_min, max=wait_max),
                retry=retry_if_exception_type((HTTPStatusError, TimeoutException, asyncio.TimeoutError)),
                before_sleep=_log_before_sleep,
                reraise=True,
            ):
                with attempt:
                    return await func(*args, **kwargs)

        return wrapper

    return decorator


def _log_before_sleep(retry_state) -> None:
    logger.warning(
        "retrying_external_api_call",
        attempt=retry_state.attempt_number,
        wait_seconds=retry_state.next_action.sleep if retry_state.next_action else None,
        exc_type=type(retry_state.outcome.exception()).__name__ if retry_state.outcome else None,
        exc_message=str(retry_state.outcome.exception()) if retry_state.outcome else None,
    )
