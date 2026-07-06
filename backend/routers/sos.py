"""
SafeHer — SOS Event API
==========================
Endpoint: POST /sos/log

Records emergency SOS activations.
This is NOT the alert dispatcher (the frontend sends the actual emails
via EmailJS for reliability and speed).
This endpoint exists to keep an audit trail, build heatmaps of where
emergencies happen, and prevent abuse.
"""

import logging
from typing import Literal
from fastapi import APIRouter, Request

from pydantic import BaseModel, Field

from services.sos_service import log_sos_event
from core.config import get_settings

logger = logging.getLogger("safeher.router.sos")

router = APIRouter(prefix="/sos", tags=["sos"])
settings = get_settings()

VALID_TRIGGERS = Literal["button_hold", "voice_command", "disguise_mode", "test"]


class SOSEvent(BaseModel):
    """Schema for logging an SOS activation."""
    session_id: str = Field(..., description="Unique ID for this emergency session")
    lat: float = Field(..., description="User latitude at activation")
    lng: float = Field(..., description="User longitude at activation")
    timestamp: int = Field(..., description="Unix timestamp (milliseconds)")
    trigger_method: VALID_TRIGGERS = Field(..., description="How SOS was activated")
    lang_at_trigger: str = Field(default="unknown", description="UI language when triggered")


@router.post("/log", status_code=201)
async def log_sos(event: SOSEvent, request: Request):
    """
    Log an SOS activation.

    Design:
      - Fire-and-forget: client shouldn't wait for this
      - Deduplicated: prevents double-logging if button and voice both trigger
    """
    # Ignore test events
    if event.trigger_method == "test":
        return {"logged": True, "note": "Test event ignored"}

    # Basic bounds check (don't fail the request, just log it)
    is_valid_location = (
        settings.BD_LAT_MIN <= event.lat <= settings.BD_LAT_MAX and
        settings.BD_LNG_MIN <= event.lng <= settings.BD_LNG_MAX
    )

    if not is_valid_location:
        logger.warning(f"SOS logged outside Bangladesh: {event.lat}, {event.lng}")

    client_ip = request.client.host if request.client else "unknown"

    # Save to db/file
    await log_sos_event(event, client_ip)

    return {"logged": True}
