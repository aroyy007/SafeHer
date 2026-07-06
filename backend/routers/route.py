"""
SafeHer — Route Recommendation API
====================================
Endpoint: GET /route

Calculates two paths between origin and destination:
  1. Safe route (optimized for safety_cost)
  2. Fast route (optimized for distance)

Returns both as GeoJSON FeatureCollections for Mapbox rendering.
"""

import logging
from fastapi import APIRouter, Query, Request

from services.routing_service import compute_routes_geojson
from core.config import get_settings
from core.exceptions import OutOfBoundsError

logger = logging.getLogger("safeher.router.route")

router = APIRouter(prefix="/route", tags=["routing"])
settings = get_settings()


@router.get("/")
async def get_route(
    olat: float = Query(..., description="Origin latitude"),
    olng: float = Query(..., description="Origin longitude"),
    dlat: float = Query(..., description="Destination latitude"),
    dlng: float = Query(..., description="Destination longitude"),
):
    """
    Get safe and fast routes.

    Validations:
      - Origin and destination must be within Bangladesh bounds
      - Origin and destination cannot be exactly the same
    """
    # 1. Validate bounding box (Bangladesh)
    if not (settings.BD_LAT_MIN <= olat <= settings.BD_LAT_MAX) or \
       not (settings.BD_LNG_MIN <= olng <= settings.BD_LNG_MAX):
        raise OutOfBoundsError("Origin coordinates are outside Bangladesh.")

    if not (settings.BD_LAT_MIN <= dlat <= settings.BD_LAT_MAX) or \
       not (settings.BD_LNG_MIN <= dlng <= settings.BD_LNG_MAX):
        raise OutOfBoundsError("Destination coordinates are outside Bangladesh.")

    # 2. Check identical coords (prevent A* from spinning on identical points)
    if abs(olat - dlat) < 0.00001 and abs(olng - dlng) < 0.00001:
        # User is already at the destination
        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [olng, olat]},
                "properties": {
                    "message": "You are already at your destination.",
                    "distance_m": 0,
                }
            }]
        }

    # 3. Compute routes
    # Service layer handles GraphNotLoadedError, NoPathFoundError, etc.
    # which are caught by the global exception handlers.
    geojson_result = await compute_routes_geojson(olat, olng, dlat, dlng)

    return geojson_result
