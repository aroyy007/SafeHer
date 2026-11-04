"""SOS audit logging and authenticated SMTP fallback endpoints."""

import logging
from typing import List, Literal, Optional
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from core.config import get_settings
from core.rate_limiter import _check_and_record
from routers.auth import get_current_user
from services.sos_alert_service import send_sos_emails, smtp_configured
from services.sos_service import log_sos_event

logger = logging.getLogger("safeher.router.sos")
router = APIRouter(prefix="/sos", tags=["sos"])
settings = get_settings()

VALID_TRIGGERS = Literal["button_hold", "voice_command", "disguise_mode", "test"]


async def _limit_sos_log(request: Request) -> None:
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    allowed, _, retry_after = _check_and_record(
        "sos_log", f"ip:{client_ip}", max_requests=20, window_seconds=300
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many SOS log requests",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )


class SOSEvent(BaseModel):
    """Audit metadata for one browser SOS session."""

    session_id: str = Field(..., min_length=8, max_length=128)
    lat: Optional[float] = None
    lng: Optional[float] = None
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")
    trigger_method: VALID_TRIGGERS
    lang_at_trigger: str = Field(default="unknown", max_length=32)

    @model_validator(mode="after")
    def validate_location_pair(self):
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be supplied together")
        return self


@router.post("/log", status_code=201, dependencies=[Depends(_limit_sos_log)])
async def log_sos(event: SOSEvent):
    if event.trigger_method == "test":
        return {"logged": True, "note": "Test event ignored"}

    has_valid_location = (
        event.lat is not None
        and event.lng is not None
        and settings.BD_LAT_MIN <= event.lat <= settings.BD_LAT_MAX
        and settings.BD_LNG_MIN <= event.lng <= settings.BD_LNG_MAX
    )
    if not has_valid_location:
        event.lat = None
        event.lng = None

    await log_sos_event(event)
    return {"logged": True}


class AlertRecipient(BaseModel):
    name: str = Field(default="", max_length=80)
    email: EmailStr

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if any(ord(char) < 32 for char in value):
            raise ValueError("control characters are not allowed")
        return value


class SOSAlertRequest(BaseModel):
    """Server-side alert content; recipient ownership is checked separately."""

    from_name: str = Field(..., min_length=1, max_length=80)
    from_phone: str = Field(..., min_length=1, max_length=40)
    location_address: str = Field(default="Location unavailable", max_length=400)
    tracking_link: str = Field(..., min_length=8, max_length=800)
    time_str: str = Field(..., min_length=4, max_length=120)
    recipients: List[AlertRecipient] = Field(..., min_length=1, max_length=30)

    @field_validator("from_name", "from_phone", "time_str")
    @classmethod
    def reject_control_characters(cls, value: str) -> str:
        value = value.strip()
        if any(ord(char) < 32 and char != "\t" for char in value):
            raise ValueError("control characters are not allowed")
        return value

    @field_validator("tracking_link")
    @classmethod
    def validate_tracking_link(cls, value: str) -> str:
        parsed = urlsplit(value)
        allowed_origins = {
            origin.strip().rstrip("/")
            for origin in settings.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        }
        allowed_origins.update({
            "http://localhost:3000", "http://localhost:5173", "http://localhost:4173",
            "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:4173",
            "https://safeher.app", "https://www.safeher.app",
        })
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in allowed_origins or not parsed.path.startswith("/track/"):
            raise ValueError("tracking_link must use an allowed SafeHer origin and tracking path")
        return value


async def _limit_sos_alert(request: Request, user: dict = Depends(get_current_user)) -> None:
    allowed, _, retry_after = _check_and_record(
        "sos_alert", user["id"], max_requests=5, window_seconds=300
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many SOS email fallback requests",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )


@router.post("/alert", dependencies=[Depends(_limit_sos_alert)])
async def sos_alert(req: SOSAlertRequest, user: dict = Depends(get_current_user)):
    """Send fallback emails only to this authenticated user's saved contacts."""
    if not smtp_configured():
        raise HTTPException(status_code=503, detail="Server-side email dispatch is not configured")

    from services.auth_service import get_sos_recipients

    allowed_emails = {
        row["email"].strip().casefold()
        for row in await get_sos_recipients(user["id"])
        if row.get("email")
    }
    requested_emails = {str(row.email).strip().casefold() for row in req.recipients}
    if not requested_emails.issubset(allowed_emails):
        raise HTTPException(status_code=403, detail="Recipient is not in your trusted contacts")

    recipients_by_email = {}
    for row in req.recipients:
        recipients_by_email.setdefault(str(row.email).strip().casefold(), row)

    try:
        result = await send_sos_emails(
            recipients=[row.model_dump() for row in recipients_by_email.values()],
            from_name=user.get("name") or req.from_name,
            from_phone=user.get("phone") or req.from_phone,
            time_str=req.time_str,
            location_address=req.location_address,
            tracking_link=req.tracking_link,
        )
        return {"dispatched": result["sent"] > 0, **result}
    except Exception as exc:
        logger.error("SOS fallback dispatch failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="dispatch_failed") from exc
