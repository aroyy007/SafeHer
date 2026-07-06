"""
SafeHer — Incident Service
============================
Handles storing and retrieving community safety reports.

Graceful degradation:
  - If USE_SUPABASE is true, uses PostGIS for fast spatial queries.
  - If USE_SUPABASE is false, uses a local SQLite DB with haversine distance.
    (This ensures the hackathon demo works even if the DB goes down).
"""

import logging
from typing import List, Dict, Any

from core.config import get_settings

logger = logging.getLogger("safeher.incident_service")
settings = get_settings()


async def save_incident(incident_data, client_ip: str) -> Dict[str, Any]:
    """Save a new incident report."""
    if settings.USE_SUPABASE:
        return await _save_supabase(incident_data, client_ip)
    else:
        return await _save_local(incident_data, client_ip)


async def get_nearby_incidents(lat: float, lng: float, radius_m: int, days_back: int) -> List[Dict]:
    """Get incidents within radius."""
    if settings.USE_SUPABASE:
        return await _get_nearby_supabase(lat, lng, radius_m, days_back)
    else:
        return await _get_nearby_local(lat, lng, radius_m, days_back)


# --- Supabase Implementation ---

async def _save_supabase(data, ip: str):
    from db.supabase_client import get_supabase
    supabase = get_supabase()

    # PostGIS point format: 'SRID=4326;POINT(lng lat)'
    # Note: PostGIS uses Longitude First
    point = f"SRID=4326;POINT({data.lng} {data.lat})"

    res = supabase.table("incidents").insert({
        "lat": data.lat,
        "lng": data.lng,
        "location": point,
        "category": data.category,
        "description": data.description,
        "time_of_day": data.time_of_day,
        "anonymous": data.anonymous,
        "client_ip_hash": hash(ip),  # Simple privacy-preserving hash
    }).execute()

    return res.data[0] if res.data else {"id": "unknown"}


async def _get_nearby_supabase(lat: float, lng: float, radius_m: int, days_back: int):
    from db.supabase_client import get_supabase
    supabase = get_supabase()

    # We use a database function (RPC) to do the PostGIS query since
    # Supabase JS/Python clients can't do complex PostGIS filters natively yet
    res = supabase.rpc(
        "get_incidents_within",
        {"lat_param": lat, "lng_param": lng, "radius_meters": radius_m, "days_back": days_back}
    ).execute()

    return res.data if res.data else []


# --- Local SQLite Fallback Implementation ---

async def _save_local(data, ip: str):
    from db.local_db import insert_incident
    import uuid

    incident_id = str(uuid.uuid4())
    await insert_incident({
        "id": incident_id,
        "lat": data.lat,
        "lng": data.lng,
        "category": data.category,
        "description": data.description,
        "time_of_day": data.time_of_day,
        "anonymous": data.anonymous,
    })

    return {"id": incident_id}


async def _get_nearby_local(lat: float, lng: float, radius_m: int, days_back: int):
    from db.local_db import get_incidents_in_radius
    return await get_incidents_in_radius(lat, lng, radius_m, days_back)
