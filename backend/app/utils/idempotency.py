import hashlib
import json

import aioredis

from app.core.config import settings


def get_redis() -> aioredis.Redis:
    """Return a Redis client configured from application settings."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def generate_key(*parts: str) -> str:
    """Produce a deterministic SHA-256 hex digest from the joined parts."""
    raw = ":".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


async def check_and_set(
    redis: aioredis.Redis,
    key: str,
    result: dict,
    ttl: int = 86400,
) -> tuple[bool, dict | None]:
    """Guard against duplicate Xero writes using Redis idempotency keys.

    Returns:
        (True, None)        — key was new; ``result`` has been stored under the key.
        (False, cached)     — key already existed; ``cached`` is the previously stored dict.
    """
    redis_key = f"idempotency:{key}"
    cached_raw = await redis.get(redis_key)
    if cached_raw is not None:
        return False, json.loads(cached_raw)

    await redis.setex(redis_key, ttl, json.dumps(result))
    return True, None
