"""
SafeHer — Main Application Entry Point
========================================
FastAPI application with lifespan management.

Usage for local dev:
  uvicorn main:app --reload

Usage for production (Render):
  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.exceptions import register_exception_handlers
from routing.graph_loader import load_graph
from rag.knowledge_base import seed_if_empty
from db.local_db import init_db

# Routers
from routers.chat import router as chat_router
from routers.route import router as route_router
from routers.incidents import router as incident_router
from routers.sos import router as sos_router
from routers.geocode import router as geocode_router
from routers.circles import router as circles_router
from routers.auth import router as auth_router
from routers.health import health_router, heatmap_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("safeher.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown sequence.
    Handles heavy initialization before serving traffic.
    """
    settings = get_settings()
    logger.info("Starting SafeHer Backend...")
    if settings.LITE_MODE:
        logger.warning(
            "LITE_MODE=true — skipping Bengali SBERT pre-load and ChromaDB "
            "auto-seeding to fit on Render free tier (512MB RAM). Chat and "
            "RAG endpoints will degrade gracefully."
        )

    # 1. Initialize local SQLite fallback
    if not settings.USE_SUPABASE:
        await init_db()

    # 2. Seed Knowledge Base (if empty)
    # Skipped entirely in LITE_MODE — would OOM on Render free tier.
    # The chat endpoint will lazy-load the fallback MiniLM model on demand.
    if not settings.LITE_MODE:
        try:
            seed_if_empty()
        except Exception as e:
            logger.error(f"Failed to seed knowledge base: {e}")
            # We don't crash — chat will gracefully degrade to emergency numbers
    else:
        logger.info("Skipping knowledge-base seed (LITE_MODE).")

    # 3. Load OSM Routing Graph
    # This loads the ~25MB .graphml file into RAM
    # If it fails, the server still starts, but /route returns 503
    if not settings.LITE_MODE:
        try:
            load_graph()
        except Exception as e:
            logger.error(f"Failed to load routing graph: {e}")
    else:
        logger.info("Skipping routing graph load (LITE_MODE).")

    logger.info("SafeHer Backend ready for traffic.")
    yield
    logger.info("Shutting down SafeHer Backend...")


# Initialize FastAPI
app = FastAPI(
    title="SafeHer Backend API",
    description="Safety backend for women in Bangladesh. Features: RAG Chat, Safe Routing, SOS Logging.",
    version="1.0.0",
    lifespan=lifespan,
)

# Register Exception Handlers (no raw 500s)
register_exception_handlers(app)


# Build CORS allow-list from env (comma-separated). Defaults include
# common dev hosts so the demo works out-of-the-box.
def _build_allowed_origins() -> list[str]:
    settings = get_settings()
    raw = settings.ALLOWED_ORIGINS.strip()
    if not raw or raw == "*":
        # Production-safe default — dev hosts that the team actually uses.
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:4173",
            # SafeHer frontend on Vercel/Netlify (override via env in prod)
            "https://safeher.app",
            "https://www.safeher.app",
        ]
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(chat_router)
app.include_router(route_router)
app.include_router(incident_router)
app.include_router(sos_router)
app.include_router(geocode_router)
app.include_router(circles_router)
app.include_router(auth_router)
app.include_router(health_router)
app.include_router(heatmap_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to SafeHer API",
        "docs": "/docs",
        "emergency": "If in danger, call 999",
    }
