"""
SafeHer — Routing Service
===========================
Orchestrates graph lookups and GeoJSON conversions.
"""

import asyncio
import logging

from routing.graph_loader import get_graph
from routing.pathfinder import find_routes
from routing.geojson_builder import path_to_geojson, routes_to_feature_collection
from core.exceptions import NoPathFoundError

logger = logging.getLogger("safeher.routing_service")

# Hard timeout for any single /route request — the A* + Dijkstra on a
# 25MB graph can spike to several seconds; if it takes longer the user
# is better off seeing a clear error than blocking the worker indefinitely.
ROUTE_TIMEOUT_S = 10.0


async def compute_routes_geojson(olat: float, olng: float, dlat: float, dlng: float) -> dict:
    """
    Computes safe and fast routes, returning them as a GeoJSON FeatureCollection.
    Runs NetworkX blocking calls in a thread pool to avoid freezing FastAPI.
    Bounded by ROUTE_TIMEOUT_S to prevent a slow request from blocking
    the entire worker.
    """
    # 1. Get graph (raises if not loaded)
    G = get_graph()

    # 2. Run blocking pathfinding in a thread, with an upper bound.
    # asyncio.to_thread (Python 3.9+) is safer than run_in_executor(None, ...)
    # because it always uses the *currently running* loop.
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(find_routes, olat, olng, dlat, dlng),
            timeout=ROUTE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.error(f"Route computation timed out after {ROUTE_TIMEOUT_S}s")
        raise NoPathFoundError(
            "Route calculation took too long. Try origins closer to main roads."
        ) from None

    # 3. Convert node paths to GeoJSON
    safe_geojson = path_to_geojson(G, result["safe_nodes"], route_type="safe")
    fast_geojson = path_to_geojson(G, result["fast_nodes"], route_type="fast")

    # 4. Attach top-level summary to the safe route's properties
    safe_geojson["properties"]["summary"] = {
        "safe_distance_m": result["safe_distance_m"],
        "fast_distance_m": result["fast_distance_m"],
        "extra_distance_m": result["extra_distance_m"],
        "extra_minutes": result["extra_minutes"],
        "safe_avg_safety": result["safe_avg_safety"],
        "fast_avg_safety": result["fast_avg_safety"],
    }

    # 5. Wrap in FeatureCollection
    return routes_to_feature_collection(safe_geojson, fast_geojson)
