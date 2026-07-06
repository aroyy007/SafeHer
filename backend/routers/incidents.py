"""
SafeHer — Incident Reporting API
==================================
Endpoints:
  - POST /incidents : Submit a new safety report
  - GET /incidents/nearby : Fetch recent reports within a radius

Supports graceful degradation:
  If USE_SUPABASE=true, writes to Supabase PostGIS.
  If USE_SUPABASE=false, writes to local SQLite (for dev/demo without keys).
"""

import logging
from typing import Literal, List, Optional
from fastapi import APIRouter, Depends, Query, Request

from pydantic import BaseModel, Field, field_validator
from datetime import datetime

from services.incident_service import save_incident, get_nearby_incidents
from core.config import get_settings
from core.exceptions import OutOfBoundsError
from core.rate_limiter import incident_rate_limit

logger = logging.getLogger("safeher.router.incidents")

router = APIRouter(prefix="/incidents", tags=["incidents"])
settings = get_settings()

VALID_CATEGORIES = Literal[
    "eve_teasing", "stalking", "physical_assault", "rape",
    "robbery", "unsafe_lighting", "unsafe_transport", "other"
]
VALID_TIME = Literal["morning", "afternoon", "evening", "night"]


class IncidentCreate(BaseModel):
    """Schema for submitting a new incident report."""
    lat: float = Field(..., description="Latitude of incident")
    lng: float = Field(..., description="Longitude of incident")
    category: VALID_CATEGORIES = Field(..., description="Type of incident")
    description: str = Field(default="", description="Optional context")
    time_of_day: VALID_TIME = Field(default="night")
    anonymous: bool = Field(default=True)
    session_id: Optional[str] = Field(default=None, description="For rate limiting")

    @field_validator("lat")
    @classmethod
    def check_lat(cls, v):
        if not (settings.BD_LAT_MIN <= v <= settings.BD_LAT_MAX):
            raise ValueError("Latitude outside Bangladesh bounds")
        return v

    @field_validator("lng")
    @classmethod
    def check_lng(cls, v):
        if not (settings.BD_LNG_MIN <= v <= settings.BD_LNG_MAX):
            raise ValueError("Longitude outside Bangladesh bounds")
        return v

    @field_validator("description")
    @classmethod
    def clean_description(cls, v):
        # Prevent massive text blocks and basic XSS mitigation
        v = v.strip()
        if len(v) > 500:
            v = v[:497] + "..."
        # Strip HTML tags
        import re
        v = re.sub(r'<[^>]*>', '', v)
        return v


@router.post(
    "/",
    status_code=201,
    dependencies=[Depends(incident_rate_limit())],
)
async def report_incident(incident: IncidentCreate, request: Request):
    """
    Submit a new safety incident report.
    Returns the created incident ID.
    """
    # Get client IP for rate limiting (fallback if session_id missing)
    client_ip = request.client.host if request.client else "unknown"

    result = await save_incident(incident, client_ip)
    return {
        "success": True,
        "id": result.get("id"),
        "message": "Report received. Thank you for making the community safer.",
    }


@router.get("/nearby")
async def nearby_incidents(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_m: int = Query(1000, ge=100, le=settings.MAX_NEARBY_RADIUS_M, description="Search radius in meters"),
    days_back: int = Query(30, ge=1, le=365, description="Only show incidents from last N days"),
):
    """
    Fetch incidents near a specific location.
    Returns GeoJSON format suitable for Mapbox plotting.
    """
    if not (settings.BD_LAT_MIN <= lat <= settings.BD_LAT_MAX) or \
       not (settings.BD_LNG_MIN <= lng <= settings.BD_LNG_MAX):
        raise OutOfBoundsError("Search coordinates outside Bangladesh.")

    incidents = await get_nearby_incidents(lat, lng, radius_m, days_back)

    # Convert to GeoJSON FeatureCollection
    features = []
    for inc in incidents:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [inc["lng"], inc["lat"]]
            },
            "properties": {
                "id": str(inc.get("id", "")),
                "category": inc["category"],
                "time_of_day": inc.get("time_of_day", "unknown"),
                "description": inc.get("description", ""),
                "created_at": inc.get("created_at", ""),
                "report_count": inc.get("report_count", 1),
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
