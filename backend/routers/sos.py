"""
SafeHer — SOS Event API
==========================
Endpoints (all prefixed /sos):
  POST /log        — audit log of the SOS activation (used for heatmaps)
  POST /alert      — server-side email dispatch (backup path, SMTP only)

The frontend dispatches the actual SOS email via EmailJS for reliability
(works even if the backend is asleep). This /alert endpoint exists so
production deployments can flip a flag and have the backend send
emails itself when EmailJS is over quota or blocked.
"""

import logging
from typing import Literal, List
from fastapi import APIRouter, HTTPException, Request

from pydantic import BaseModel, Field, EmailStr

from services.sos_service import log_sos_event
from services.sos_alert_service import send_sos_emails, smtp_configured
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
        settings.BD_LAT_MIN <= event.lat <= event.BD_LAT_MAX and
        settings.BD_LNG_MIN <= event.lng <= settings.BD_LNG_MAX
    )

    if not is_valid_location:
        logger.warning(f"SOS logged outside Bangladesh: {event.lat}, {event.lng}")

    client_ip = request.client.host if request.client else "unknown"

    # Save to db/file
    await log_sos_event(event, client_ip)

    return {"logged": True}


# ----- /sos/alert ----------------------------------------------------------

class AlertRecipient(BaseModel):
    name: str = Field(default="", max_length=80)
    email: EmailStr


class SOSAlertRequest(BaseModel):
    """Schema for backend-side SOS email dispatch (SMTP fallback)."""
    from_name: str = Field(..., min_length=1, max_length=80)
    from_phone: str = Field(..., min_length=3, max_length=40)
    location_address: str = Field(default="Location unavailable", max_length=400)
    tracking_link: str = Field(..., min_length=8, max_length=800)
    time_str: str = Field(..., min_length=4, max_length=120)
    recipients: List[AlertRecipient] = Field(..., min_length=1, max_length=30)


@router.post("/alert")
async def sos_alert(req: SOSAlertRequest):
    """
    Server-side SOS email dispatch.

    Only works if SMTP_* env vars are configured. Returns 503 with a
    clear message otherwise — the frontend should fall back to EmailJS
    in that case. This endpoint intentionally does NOT require auth so
    the SOS can fire from a fresh device even if the token has expired.
    """
    if not smtp_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Server-side email dispatch is not configured. "
                "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM "
                "in the backend environment to enable this fallback."
            ),
        )

    try:
        result = await send_sos_emails(
            recipients=[r.model_dump() for r in req.recipients],
            from_name=req.from_name,
            from_phone=req.from_phone,
            time_str=req.time_str,
            location_address=req.location_address,
            tracking_link=req.tracking_link,
        )
        return {"dispatched": True, **result}
    except Exception as e:
        logger.error(f"/sos/alert dispatch failed: {e}")
        raise HTTPException(status_code=500, detail=f"dispatch_failed: {e}")
