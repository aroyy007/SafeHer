"""
SafeHer — Heatmap & Health APIs
=================================
Endpoints:
  - GET /heatmap : Returns precomputed KDE density for Mapbox
  - GET /health  : Used by UptimeRobot to keep Render server awake
"""

import logging
from fastapi import APIRouter
import os
import json

from core.config import get_settings
from routing.graph_loader import get_graph_stats
from rag.knowledge_base import get_collection_stats

logger = logging.getLogger("safeher.router.health")

settings = get_settings()
health_router = APIRouter(tags=["health"])
heatmap_router = APIRouter(prefix="/heatmap", tags=["heatmap"])


@health_router.get("/health")
def health_check():
    """
    Health check endpoint.
    Critical for Render: keeps the free tier instance awake.
    Returns status of the two heavy components: Graph and ChromaDB.
    In LITE_MODE the heavy components are intentionally unloaded and the
    status field reports 'lite' so dashboards / UptimeRobot can tell.
    """
    if settings.LITE_MODE:
        return {
            "status": "lite",
            "lite_mode": True,
            "graph": {"loaded": False, "note": "Skipped due to LITE_MODE"},
            "knowledge_base": {"document_count": 0, "note": "Skipped due to LITE_MODE"},
        }

    graph_stats = get_graph_stats()
    kb_stats = get_collection_stats()

    status = "ok"
    if not graph_stats["loaded"]:
        status = "degraded (graph missing)"
    if kb_stats.get("document_count", 0) == 0:
        status = "degraded (kb empty)"

    return {
        "status": status,
        "lite_mode": False,
        "graph": graph_stats,
        "knowledge_base": kb_stats,
    }


@heatmap_router.get("/")
def get_heatmap_data():
    """
    Returns KDE density data for Mapbox heatmap rendering.
    In a real production app, this would query PostGIS and build
    density on the fly, or serve a precomputed vector tile.
    For the hackathon, we serve the hand-curated hotspots.
    """
    hotspot_path = "data/chittagong_incidents.geojson"

    if os.path.exists(hotspot_path):
        try:
            with open(hotspot_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load heatmap data: {e}")

    # Fallback empty GeoJSON
    return {
        "type": "FeatureCollection",
        "features": []
    }
