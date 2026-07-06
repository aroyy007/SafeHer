"""
SafeHer — SOS Logging Service
===============================
Logs SOS activations. Includes a 30-second deduplication window
so if a user presses the button AND says the voice command in panic,
it only logs as one emergency event.
"""

import logging
import time
from typing import Dict

from core.config import get_settings

logger = logging.getLogger("safeher.sos_service")
settings = get_settings()

# Simple in-memory cache for deduplication
# Key: session_id, Value: timestamp of last log
_recent_sos_events: Dict[str, int] = {}
DEDUP_WINDOW_MS = 30_000  # 30 seconds


async def log_sos_event(event_data, client_ip: str):
    """Log an SOS event, deduplicating fast subsequent triggers."""
    now = int(time.time() * 1000)

    # 1. Deduplication check
    last_trigger = _recent_sos_events.get(event_data.session_id, 0)
    if now - last_trigger < DEDUP_WINDOW_MS:
        logger.info(f"SOS deduplicated for session {event_data.session_id}")
        return

    _recent_sos_events[event_data.session_id] = now

    # 2. Clean up old cache entries
    _cleanup_dedup_cache(now)

    # 3. Save
    try:
        if settings.USE_SUPABASE:
            from db.supabase_client import get_supabase
            supabase = get_supabase()
            supabase.table("sos_events").insert({
                "session_id": event_data.session_id,
                "lat": event_data.lat,
                "lng": event_data.lng,
                "timestamp_ms": event_data.timestamp,
                "trigger_method": event_data.trigger_method,
                "lang_at_trigger": event_data.lang_at_trigger,
            }).execute()
        else:
            # Local file fallback
            from db.local_db import insert_sos_log
            await insert_sos_log(event_data.model_dump())

        logger.critical(
            f"🚨 SOS ACTIVATED: method={event_data.trigger_method}, "
            f"loc={event_data.lat},{event_data.lng}"
        )
    except Exception as e:
        logger.error(f"Failed to log SOS event: {e}")
        # We don't raise here — the user shouldn't see an error when
        # triggering an SOS just because our analytics DB failed.


def _cleanup_dedup_cache(now_ms: int):
    """Remove entries older than the window to prevent memory leaks."""
    keys_to_remove = [
        k for k, v in _recent_sos_events.items()
        if now_ms - v > DEDUP_WINDOW_MS
    ]
    for k in keys_to_remove:
        del _recent_sos_events[k]
