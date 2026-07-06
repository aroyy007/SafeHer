"""
SafeHer — Per-session Rate Limiter
====================================
A simple in-memory sliding-window limiter, scoped per session/user key.

Why custom instead of slowapi/Redis:
  - Hackathon scale (<1k concurrent users) — in-memory is plenty.
  - Zero new dependencies to install.
  - The /chat endpoint is safety-critical; if Redis is down we don't
    want to start 503-ing chat. In-memory degrades gracefully per process.

The limiter exposes a FastAPI dependency `rate_limit(...)` so routers
can declare their own cap with one line.

For multi-instance production, swap the `_buckets` dict for a Redis
backend (the rest of the API doesn't change).
"""

import logging
import time
from collections import deque
from threading import Lock
from typing import Deque, Dict, Optional

from fastapi import Depends, Header, HTTPException, Request

from core.config import get_settings

logger = logging.getLogger("safeher.rate_limiter")

# Per-process sliding window storage. Key = (bucket_name, session_id).
_buckets: Dict[tuple, Deque[float]] = {}
_buckets_lock = Lock()


def _check_and_record(
    bucket: str,
    key: str,
    max_requests: int,
    window_seconds: int,
) -> tuple[bool, int, float]:
    """
    Check if `key` is under the cap, and record the hit.
    Returns (allowed, remaining, retry_after_seconds).
    """
    full_key = (bucket, key)
    now = time.monotonic()
    cutoff = now - window_seconds

    with _buckets_lock:
        dq = _buckets.get(full_key)
        if dq is None:
            dq = deque()
            _buckets[full_key] = dq

        # Drop expired entries
        while dq and dq[0] < cutoff:
            dq.popleft()

        if len(dq) >= max_requests:
            # The oldest entry will exit the window in `retry_after` seconds.
            retry_after = max(1.0, window_seconds - (now - dq[0]))
            return False, 0, retry_after

        dq.append(now)
        remaining = max_requests - len(dq)
        return True, remaining, 0.0


def _client_key(request: Request, x_session_id: Optional[str]) -> str:
    """
    Pick the best available identifier for rate limiting.
    Order: explicit session header → client IP → "anonymous".
    """
    if x_session_id and x_session_id.strip():
        return f"session:{x_session_id.strip()}"
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "anonymous"


def rate_limit(bucket: str, max_requests: int, window_seconds: int):
    """
    Build a FastAPI dependency that enforces `max_requests` per
    `window_seconds` per session/IP, keyed by `bucket`.

    Usage:
        @router.post("/", dependencies=[Depends(rate_limit("chat", 30, 60))])
        async def chat(...): ...
    """

    async def _dep(
        request: Request,
        x_session_id: Optional[str] = Header(default=None),
    ) -> None:
        key = _client_key(request, x_session_id)
        allowed, remaining, retry_after = _check_and_record(
            bucket, key, max_requests, window_seconds
        )
        if not allowed:
            logger.info(f"Rate limit hit: bucket={bucket} key={key}")
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Too many requests. Please slow down.",
                    "retry_after_seconds": int(retry_after) + 1,
                },
                headers={"Retry-After": str(int(retry_after) + 1)},
            )

    return _dep


# --- Pre-built limits for common endpoints ---

def chat_rate_limit():
    """30 chat queries / minute / session — prevents LLM bill explosion."""
    return rate_limit("chat", max_requests=30, window_seconds=60)


def geocode_rate_limit():
    """Nominatim upstream is 1 RPS; cap clients to 10/min to be polite."""
    return rate_limit("geocode", max_requests=10, window_seconds=60)


def incident_rate_limit():
    """10 reports / hour / session — discourages spam without blocking real reports."""
    settings = get_settings()
    return rate_limit(
        "incidents",
        max_requests=settings.MAX_INCIDENTS_PER_HOUR,
        window_seconds=3600,
    )