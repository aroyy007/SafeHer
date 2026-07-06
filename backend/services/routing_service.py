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

logger = logging.getLogger("safeher.routing_service")


async def compute_routes_geojson(olat: float, olng: float, dlat: float, dlng: float) -> dict:
    """
    Computes safe and fast routes, returning them as a GeoJSON FeatureCollection.
    Runs NetworkX blocking calls in a thread pool to avoid freezing FastAPI.
    """
    # 1. Get graph (raises if not loaded)
    G = get_graph()

    # 2. Run blocking pathfinding in executor
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        find_routes,
        olat, olng, dlat, dlng
    )

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
