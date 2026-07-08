"""
SafeHer — OSM Graph Loader
=============================
Loads the precomputed Chittagong walk graph (.graphml) at startup.

Thread-safe singleton pattern:
  - load_graph() called once during FastAPI lifespan startup
  - get_graph() returns the loaded graph for all subsequent requests
  - Raises GraphNotLoadedError if called before load_graph() completes

The .graphml file is produced by precompute/build_graph.py and committed
to the repo. It contains ~50K nodes and ~100K edges with safety_cost
and safety_score attributes on each edge.

If the graph file doesn't exist (first clone, no dataset yet), the
loader logs a warning and the routing endpoints return 503.

IMPORTANT: GraphML round-trips numeric edge attributes as STRINGS
(osmnx saves them as floats, but the XML serializer downcasts them).
Without coercing them back to float, networkx.astar_path crashes with
"unsupported operand type(s) for +: 'int' and 'str'" because it tries
to sum the heuristic (int) with the edge weight (str).

LAZY IMPORTS:
  networkx is imported inside load_graph() and inside type-checked
  helpers, NOT at module top, so importing this module from the
  FastAPI lifespan (in LITE_MODE) does NOT pull networkx into RAM.
"""

import os
import logging
from typing import Optional

from core.config import get_settings
from core.exceptions import GraphNotLoadedError

logger = logging.getLogger("safeher.graph_loader")

# Module-level singleton — type hints only; actual nx.MultiDiGraph object
# is created lazily inside load_graph().
_graph: Optional["object"] = None
_graph_loaded: bool = False
_graph_error: Optional[str] = None


# Attributes we expect to be numeric on each edge. GraphML serializes
# them as strings, so we have to coerce at load time.
_NUMERIC_EDGE_ATTRS = (
    "length",
    "safety_cost",
    "safety_score",
    "lighting_score",
    "road_type_score",
    "incident_score",
)


def _coerce_edge_attrs(G) -> int:
    """Coerce numeric edge attributes from str → float in place.

    Returns the number of edges coerced.
    """
    coerced = 0
    for _u, _v, data in G.edges(data=True):
        for attr in _NUMERIC_EDGE_ATTRS:
            if attr in data and not isinstance(data[attr], (int, float)):
                try:
                    data[attr] = float(data[attr])
                    coerced += 1
                except (TypeError, ValueError):
                    # Leave a sensible default so pathfinders don't crash
                    data[attr] = 0.0 if attr != "length" else 50.0
    return coerced


def load_graph() -> bool:
    """
    Load the precomputed .graphml graph file.
    Called once during FastAPI startup.

    Returns:
        True if graph loaded successfully, False otherwise
    """
    global _graph, _graph_loaded, _graph_error

    # Lazy import — keeps ~150 MB of networkx out of the boot-time import
    # graph when LITE_MODE=true (Render free tier).
    import networkx as nx

    settings = get_settings()
    graph_path = settings.GRAPH_PATH

    if not os.path.exists(graph_path):
        _graph_error = f"Graph file not found: {graph_path}"
        logger.warning(
            f"⚠ {_graph_error}. "
            f"Route recommendation will be unavailable. "
            f"Run 'python precompute/build_graph.py' to create it."
        )
        _graph_loaded = False
        return False

    try:
        logger.info(f"Loading graph from: {graph_path}")

        # osmnx has a load_graphml function, but we can also use networkx directly
        try:
            import osmnx as ox
            _graph = ox.load_graphml(graph_path)
            logger.info(
                f"✓ Graph loaded via osmnx: "
                f"{_graph.number_of_nodes()} nodes, "
                f"{_graph.number_of_edges()} edges"
            )
        except ImportError:
            # Fallback: load with plain networkx
            _graph = nx.read_graphml(graph_path)
            logger.info(
                f"✓ Graph loaded via networkx: "
                f"{_graph.number_of_nodes()} nodes, "
                f"{_graph.number_of_edges()} edges"
            )

        _graph_loaded = True
        _graph_error = None

        # Coerce numeric edge attributes that GraphML serialized as strings
        # — otherwise pathfinders crash with TypeError on int+str.
        try:
            n = _coerce_edge_attrs(_graph)
            if n:
                logger.info(f"Coerced {n} numeric edge attributes (str → float).")
        except Exception as e:
            logger.warning(f"Edge attribute coercion skipped: {e}")

        # Verify critical attributes exist
        _verify_graph_attributes()

        return True

    except Exception as e:
        _graph_error = f"Failed to load graph: {e}"
        logger.error(f"✗ {_graph_error}", exc_info=True)
        _graph_loaded = False
        return False


def get_graph():
    """
    Return the loaded graph singleton.

    Raises:
        GraphNotLoadedError: if the graph hasn't been loaded yet
    """
    if not _graph_loaded or _graph is None:
        raise GraphNotLoadedError(
            _graph_error or "Graph not loaded yet. Server may still be starting."
        )
    return _graph


def is_graph_loaded() -> bool:
    """Check if the graph is available (for health checks)."""
    return _graph_loaded and _graph is not None


def get_graph_stats() -> dict:
    """Return graph statistics for health/status endpoints."""
    if not _graph_loaded or _graph is None:
        return {
            "loaded": False,
            "error": _graph_error,
            "nodes": 0,
            "edges": 0,
        }

    return {
        "loaded": True,
        "nodes": _graph.number_of_nodes(),
        "edges": _graph.number_of_edges(),
        "error": None,
    }


def _verify_graph_attributes():
    """
    Verify that the loaded graph has the required edge attributes.
    Logs warnings if safety_cost or safety_score are missing.
    """
    if _graph is None:
        return

    # Check a sample of edges
    sample_count = 0
    has_safety_cost = 0
    has_safety_score = 0

    for u, v, data in _graph.edges(data=True):
        sample_count += 1
        if "safety_cost" in data:
            has_safety_cost += 1
        if "safety_score" in data:
            has_safety_score += 1
        if sample_count >= 100:
            break

    if has_safety_cost < sample_count * 0.5:
        logger.warning(
            f"⚠ Only {has_safety_cost}/{sample_count} sampled edges have 'safety_cost'. "
            f"Graph may not have been scored. Re-run precompute/build_graph.py."
        )

    if has_safety_score < sample_count * 0.5:
        logger.warning(
            f"⚠ Only {has_safety_score}/{sample_count} sampled edges have 'safety_score'. "
            f"Route safety display may not work correctly."
        )
