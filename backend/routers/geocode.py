"""
SafeHer — Geocoding API
=========================
Endpoint: GET /geocode?name=<place name>

Wraps OpenStreetMap's Nominatim service so the frontend can enter
place names ("GEC Circle", "2 No Gate", "CUET campus") and we resolve
them to lat/lng for the /route endpoint.

Design choices:
  - Single-endpoint simplicity (Nominatim is fine for hackathon scale)
  - Bangladesh-biased viewbox + countrycodes filter — keeps results local
  - In-memory 1-second throttle (Nominatim's free-tier TOS requires ≤1 RPS)
  - Graceful failure if upstream is down — frontend shows "Place not found"

IMPORTANT: Nominatim's TOS requires:
  - max 1 request/second per IP
  - a real User-Agent header identifying the application
  - not used for commercial bulk geocoding (fine for hackathon demo)
"""

import asyncio
import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from core.config import get_settings
from core.rate_limiter import geocode_rate_limit

logger = logging.getLogger("safeher.router.geocode")

router = APIRouter(prefix="/geocode", tags=["geocode"])
settings = get_settings()

# Bangladesh bounding box — biases Nominatim results to our area.
BD_VIEWBOX = (settings.BD_LNG_MIN, settings.BD_LAT_MIN, settings.BD_LNG_MAX, settings.BD_LAT_MAX)

# Throttle: Nominatim TOS requires ≤1 request/second.
_last_request_at: float = 0.0
_NOMINATIM_LOCK = asyncio.Lock()
_NOMINATIM_MIN_INTERVAL_S = 1.05  # Add 50ms cushion to be polite


class GeocodeResult(BaseModel):
    """One geocoding candidate."""
    name: str = Field(..., description="Display name as returned by Nominatim")
    lat: float
    lng: float
    importance: float = Field(default=0.0, description="Nominatim relevance score (0-1)")
    type: Optional[str] = None
    category: Optional[str] = None


class GeocodeResponse(BaseModel):
    """Geocoding API response."""
    query: str = Field(..., description="Original query string")
    results: list[GeocodeResult] = Field(default_factory=list)
    found: bool = Field(..., description="True if at least one result was returned")


async def _throttle_nominatim():
    """Ensure we don't hit Nominatim more than once per second."""
    global _last_request_at
    async with _NOMINATIM_LOCK:
        now = time.monotonic()
        wait = _NOMINATIM_MIN_INTERVAL_S - (now - _last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_at = time.monotonic()


@router.get(
    "/",
    response_model=GeocodeResponse,
    dependencies=[Depends(geocode_rate_limit())],
)
async def geocode(
    name: str = Query(
        ...,
        min_length=2,
        max_length=200,
        description="Place name (e.g. 'GEC Circle', '2 No Gate', 'CUET campus')",
    ),
):
    """
    Resolve a place name to coordinates.

    Biases results to Bangladesh via viewbox + countrycodes=bd.
    Returns up to 5 candidates ordered by Nominatim's importance score.
    """
    query = name.strip()
    if not query:
        return GeocodeResponse(query=query, found=False)

    await _throttle_nominatim()

    headers = {
        "User-Agent": "SafeHer/1.0 (hackathon project; contact: team@safeher.app)",
        "Accept": "application/json",
        "Accept-Language": "en,bn",
    }

    params = {
        "q": query,
        "format": "json",
        "addressdetails": 0,
        "limit": 5,
        "countrycodes": "bd",  # Hard limit to Bangladesh
        "viewbox": f"{BD_VIEWBOX[0]},{BD_VIEWBOX[1]},{BD_VIEWBOX[2]},{BD_VIEWBOX[3]}",
        "bounded": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers=headers,
            )
            r.raise_for_status()
            raw = r.json()
    except httpx.HTTPError as e:
        logger.warning(f"Nominatim upstream error: {e}")
        return GeocodeResponse(query=query, found=False)
    except Exception as e:
        logger.error(f"Geocode unexpected error: {e}")
        return GeocodeResponse(query=query, found=False)

    results = []
    for item in raw or []:
        try:
            results.append(
                GeocodeResult(
                    name=item.get("display_name", query),
                    lat=float(item["lat"]),
                    lng=float(item["lon"]),
                    importance=float(item.get("importance", 0.0)),
                    type=item.get("type"),
                    category=item.get("category"),
                )
            )
        except (KeyError, ValueError, TypeError):
            continue

    return GeocodeResponse(query=query, results=results, found=len(results) > 0)
