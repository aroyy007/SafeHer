"""
SafeHer — GeoJSON Builder
============================
Converts a list of graph node IDs into GeoJSON for frontend display.

Output format:
  - FeatureCollection containing one Feature per route
  - Each Feature is a LineString with the route coordinates
  - Properties include: per-segment safety scores, total distance,
    route type (safe/fast), color hints for the frontend

The frontend (Mapbox GL JS) uses these GeoJSON features directly
to render the two routes with different colors and thicknesses.
"""

from __future__ import annotations

import logging
from typing import List

# LAZY IMPORT: networkx is imported inside the functions that use it,
# NOT at module top, so importing this module from the lifespan in
# LITE_MODE does NOT pull networkx into RAM on Render free tier.

logger = logging.getLogger("safeher.geojson")


def path_to_geojson(
    G: nx.MultiDiGraph,
    nodes: List,
    route_type: str = "safe",
) -> dict:
    """
    Convert a path (list of node IDs) to a GeoJSON Feature.

    Args:
        G: NetworkX graph with node coordinates (x, y attributes)
        nodes: List of node IDs representing the path
        route_type: "safe" or "fast" (affects color and display properties)

    Returns:
        GeoJSON Feature dict with LineString geometry
    """
    if not nodes:
        return _empty_feature(route_type)

    if len(nodes) == 1:
        # Single point — user is already at destination
        node = G.nodes[nodes[0]]
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(node.get("x", 0)), float(node.get("y", 0))],
            },
            "properties": {
                "route_type": route_type,
                "distance_m": 0,
                "message": "You are already at the destination.",
            },
        }

    # Build coordinates array and collect per-segment data
    coordinates = []
    segment_scores = []
    total_distance = 0.0

    for i, node_id in enumerate(nodes):
        node = G.nodes[node_id]
        lng = float(node.get("x", 0))
        lat = float(node.get("y", 0))
        coordinates.append([lng, lat])

        # Collect segment safety data (between consecutive nodes)
        if i < len(nodes) - 1:
            edge_data = _get_edge_data(G, nodes[i], nodes[i + 1])
            safety = float(edge_data.get("safety_score", 0.5))
            length = float(edge_data.get("length", 50))
            lighting = float(edge_data.get("lighting_score", 0.5))

            segment_scores.append({
                "safety": round(safety, 3),
                "length": round(length, 1),
                "lighting": round(lighting, 3),
            })
            total_distance += length

    # Compute color based on route type
    color = "#14b8a6" if route_type == "safe" else "#f59e0b"  # teal vs amber
    weight = 5 if route_type == "safe" else 3  # thicker for safe

    # Compute average safety score
    if segment_scores:
        avg_safety = sum(s["safety"] for s in segment_scores) / len(segment_scores)
    else:
        avg_safety = 0.5

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "properties": {
            "route_type": route_type,
            "color": color,
            "weight": weight,
            "opacity": 0.85 if route_type == "safe" else 0.65,
            "distance_m": round(total_distance),
            "distance_display": _format_distance(total_distance),
            "walk_time_min": round(total_distance / 80, 1),  # 80m/min
            "avg_safety_score": round(avg_safety, 3),
            "safety_label": _safety_label(avg_safety),
            "segment_count": len(segment_scores),
            "segments": segment_scores,  # Per-segment data for detailed display
        },
    }


def routes_to_feature_collection(safe_geojson: dict, fast_geojson: dict) -> dict:
    """
    Wrap both routes into a single GeoJSON FeatureCollection.
    This is the final output format sent to the frontend.
    """
    return {
        "type": "FeatureCollection",
        "features": [safe_geojson, fast_geojson],
    }


def _empty_feature(route_type: str) -> dict:
    """Return an empty GeoJSON feature (no route found)."""
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": []},
        "properties": {
            "route_type": route_type,
            "error": "No route available",
            "distance_m": 0,
        },
    }


def _format_distance(meters: float) -> str:
    """Format distance for display."""
    if meters < 1000:
        return f"{round(meters)}m"
    else:
        return f"{meters / 1000:.1f}km"


def _safety_label(score: float) -> str:
    """Convert safety score to a human-readable label."""
    if score >= 0.7:
        return "Safe"
    elif score >= 0.45:
        return "Moderate"
    else:
        return "Caution"


def _get_edge_data(G: nx.MultiDiGraph, u, v) -> dict:
    """Get edge data, handling MultiDiGraph."""
    if G.has_edge(u, v):
        edges = G[u][v]
        if isinstance(edges, dict):
            first_key = next(iter(edges))
            data = edges[first_key]
            return data if isinstance(data, dict) else edges
        return edges
    return {}
