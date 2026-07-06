"""
SafeHer — Pathfinder
======================
A* safe route and Dijkstra shortest route computation on the
precomputed Chittagong walk graph.

Produces TWO routes for every request:
  1. Safe route (teal, thick) — A* with safety_cost weight
  2. Fast route (amber, thin) — Dijkstra with length weight

The safe route may be longer in distance but avoids dark streets,
high-crime-density areas, and dangerous road types.

Edge cases handled:
  - Origin outside graph bounds → OutOfBoundsError
  - No path exists (river/highway barrier) → NoPathFoundError
  - Origin == destination → returns single-point response
  - Graph not loaded → GraphNotLoadedError (caught by exception handler)
"""

import logging
from typing import Tuple, List, Optional

import networkx as nx

from routing.graph_loader import get_graph
from routing.safety_scorer import haversine_distance
from core.exceptions import OutOfBoundsError, NoPathFoundError

logger = logging.getLogger("safeher.pathfinder")

# Maximum snap distance: if the nearest graph node is more than
# this many meters from the requested coordinates, reject.
MAX_SNAP_DISTANCE_M = 800


def find_routes(
    olat: float, olng: float,
    dlat: float, dlng: float,
) -> dict:
    """
    Find both safe and fast routes between two points.

    Args:
        olat, olng: Origin coordinates
        dlat, dlng: Destination coordinates

    Returns:
        dict with:
          - safe_nodes: list of node IDs for safe route
          - fast_nodes: list of node IDs for fast route
          - origin_node: snapped origin node ID
          - dest_node: snapped destination node ID
          - safe_distance_m: total distance of safe route
          - fast_distance_m: total distance of fast route
          - safe_avg_safety: average safety score along safe route
          - fast_avg_safety: average safety score along fast route

    Raises:
        OutOfBoundsError: if coordinates can't be snapped to the graph
        NoPathFoundError: if no walkable path exists
    """
    G = get_graph()

    # Step 1: Snap to nearest graph nodes
    origin, origin_dist = _snap_to_graph(G, olat, olng, "Origin")
    dest, dest_dist = _snap_to_graph(G, dlat, dlng, "Destination")

    logger.info(
        f"Snapped: origin={origin} ({origin_dist:.0f}m away), "
        f"dest={dest} ({dest_dist:.0f}m away)"
    )

    # Step 2: Find safe route (A* with safety_cost)
    try:
        safe_nodes = nx.astar_path(
            G, origin, dest,
            weight="safety_cost",
            heuristic=lambda u, v: _heuristic(G, u, v),
        )
    except nx.NetworkXNoPath:
        raise NoPathFoundError(
            "No walkable path found between these points. "
            "The area may be separated by a river or highway."
        )
    except nx.NodeNotFound as e:
        raise OutOfBoundsError(f"Node not found in graph: {e}")

    # Step 3: Find fast route (shortest by distance)
    try:
        fast_nodes = nx.shortest_path(G, origin, dest, weight="length")
    except nx.NetworkXNoPath:
        # If fast route fails, use safe route as fallback
        logger.warning("Fast route not found — using safe route as fallback")
        fast_nodes = safe_nodes

    # Step 4: Compute route statistics
    safe_distance = _compute_route_distance(G, safe_nodes)
    fast_distance = _compute_route_distance(G, fast_nodes)
    safe_safety = _compute_route_avg_safety(G, safe_nodes)
    fast_safety = _compute_route_avg_safety(G, fast_nodes)

    return {
        "safe_nodes": safe_nodes,
        "fast_nodes": fast_nodes,
        "origin_node": origin,
        "dest_node": dest,
        "safe_distance_m": round(safe_distance),
        "fast_distance_m": round(fast_distance),
        "extra_distance_m": round(safe_distance - fast_distance),
        "extra_minutes": round((safe_distance - fast_distance) / 80, 1),  # 80m/min walk
        "safe_avg_safety": round(safe_safety, 3),
        "fast_avg_safety": round(fast_safety, 3),
    }


def _snap_to_graph(
    G: nx.MultiDiGraph,
    lat: float, lng: float,
    label: str,
) -> Tuple[int, float]:
    """
    Find the nearest graph node to the given coordinates.

    Returns:
        (node_id, distance_in_meters)

    Raises:
        OutOfBoundsError: if the nearest node is too far away
    """
    try:
        import osmnx as ox
        nearest = ox.nearest_nodes(G, lng, lat)
    except ImportError:
        # Fallback: brute-force nearest node search
        nearest = _nearest_node_bruteforce(G, lat, lng)

    # Compute actual distance to snapped node
    node_data = G.nodes[nearest]
    node_lat = float(node_data.get("y", 0))
    node_lng = float(node_data.get("x", 0))
    distance = haversine_distance(lat, lng, node_lat, node_lng)

    if distance > MAX_SNAP_DISTANCE_M:
        raise OutOfBoundsError(
            f"{label} is {distance:.0f}m from the nearest walkable road "
            f"(max {MAX_SNAP_DISTANCE_M}m). Check your coordinates."
        )

    return nearest, distance


def _nearest_node_bruteforce(G: nx.MultiDiGraph, lat: float, lng: float):
    """Brute-force nearest node search (fallback when osmnx not available)."""
    min_dist = float("inf")
    nearest = None

    for node, data in G.nodes(data=True):
        node_lat = float(data.get("y", 0))
        node_lng = float(data.get("x", 0))
        dist = (node_lat - lat) ** 2 + (node_lng - lng) ** 2
        if dist < min_dist:
            min_dist = dist
            nearest = node

    return nearest


def _heuristic(G: nx.MultiDiGraph, u, v) -> float:
    """
    A* heuristic: great-circle distance between two nodes.
    Must be admissible (never overestimate actual cost).
    """
    try:
        import osmnx as ox
        return ox.distance.great_circle(
            float(G.nodes[u]["y"]), float(G.nodes[u]["x"]),
            float(G.nodes[v]["y"]), float(G.nodes[v]["x"]),
        )
    except (ImportError, Exception):
        # Fallback: haversine
        return haversine_distance(
            float(G.nodes[u].get("y", 0)), float(G.nodes[u].get("x", 0)),
            float(G.nodes[v].get("y", 0)), float(G.nodes[v].get("x", 0)),
        )


def _compute_route_distance(G: nx.MultiDiGraph, nodes: list) -> float:
    """Compute total distance of a route in meters."""
    total = 0.0
    for i in range(len(nodes) - 1):
        edge_data = _get_edge_data(G, nodes[i], nodes[i + 1])
        total += float(edge_data.get("length", 50))
    return total


def _compute_route_avg_safety(G: nx.MultiDiGraph, nodes: list) -> float:
    """Compute weighted average safety score along a route."""
    if len(nodes) < 2:
        return 1.0

    total_safety = 0.0
    total_length = 0.0

    for i in range(len(nodes) - 1):
        edge_data = _get_edge_data(G, nodes[i], nodes[i + 1])
        length = float(edge_data.get("length", 50))
        safety = float(edge_data.get("safety_score", 0.5))
        total_safety += safety * length
        total_length += length

    return total_safety / total_length if total_length > 0 else 0.5


def _get_edge_data(G: nx.MultiDiGraph, u, v) -> dict:
    """Get edge data, handling MultiDiGraph (multiple edges between same nodes)."""
    if G.has_edge(u, v):
        # MultiDiGraph: get the first edge
        edges = G[u][v]
        if isinstance(edges, dict):
            # Could be {0: {data}, 1: {data}} for MultiDiGraph
            first_key = next(iter(edges))
            return edges[first_key] if isinstance(edges[first_key], dict) else edges
        return edges
    return {}
