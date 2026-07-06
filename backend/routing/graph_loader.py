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
"""

import os
import logging
from typing import Optional

import networkx as nx

from core.config import get_settings
from core.exceptions import GraphNotLoadedError

logger = logging.getLogger("safeher.graph_loader")

# Module-level singleton
_graph: Optional[nx.MultiDiGraph] = None
_graph_loaded: bool = False
_graph_error: Optional[str] = None


def load_graph() -> bool:
    """
    Load the precomputed .graphml graph file.
    Called once during FastAPI startup.

    Returns:
        True if graph loaded successfully, False otherwise
    """
    global _graph, _graph_loaded, _graph_error

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

        # Verify critical attributes exist
        _verify_graph_attributes()

        return True

    except Exception as e:
        _graph_error = f"Failed to load graph: {e}"
        logger.error(f"✗ {_graph_error}", exc_info=True)
        _graph_loaded = False
        return False


def get_graph() -> nx.MultiDiGraph:
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
