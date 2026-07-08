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
    In LITE_MODE / RAG_DISABLED the heavy components are intentionally
    unloaded and the status field reports 'lite' so dashboards /
    UptimeRobot can tell.

    IMPORTANT: do NOT import rag.* / routing.graph_loader at module load
    time — they pull in chromadb + sentence_transformers (~500 MB),
    which defeats the whole point of RAG_DISABLED on Render free tier.
    We import them lazily inside this function instead.
    """
    if settings.RAG_DISABLED or settings.LITE_MODE:
        return {
            "status": "lite",
            "lite_mode": settings.LITE_MODE,
            "rag_disabled": settings.RAG_DISABLED,
            "graph": {"loaded": False, "note": "Skipped due to LITE_MODE / RAG_DISABLED"},
            "knowledge_base": {"document_count": 0, "note": "Skipped due to LITE_MODE / RAG_DISABLED"},
        }

    from routing.graph_loader import get_graph_stats
    from rag.knowledge_base import get_collection_stats

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
        "rag_disabled": False,
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
