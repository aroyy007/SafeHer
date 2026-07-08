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
# NOTE: do NOT import `from rag.knowledge_base import seed_if_empty` or
# `from routing.graph_loader import load_graph` at the top of this
# module — those pull in chromadb + sentence_transformers (~500 MB of
# imports) and OOM-kill the Render free tier. We import them lazily
# inside the lifespan below, guarded by RAG_DISABLED / LITE_MODE.
from db.local_db import init_db

# Routers — each router's own imports must remain light. The router
# modules below deliberately use lazy imports for any heavy SDK.
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
    if settings.RAG_DISABLED:
        logger.warning(
            "RAG_DISABLED=true — /chat uses the direct Gemini/Groq path "
            "with a baked-in bilingual safety KB. ChromaDB and SBERT are "
            "NEVER imported (saves ~500 MB of RAM on Render free tier)."
        )
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
    # Skipped entirely in RAG_DISABLED or LITE_MODE — would OOM on Render
    # free tier. The chat endpoint will go straight to the LLM with the
    # baked-in KB.
    skip_seed = settings.RAG_DISABLED or settings.LITE_MODE
    if not skip_seed:
        try:
            # Lazy import: chromadb + sentence_transformers are heavy.
            from rag.knowledge_base import seed_if_empty
            seed_if_empty()
        except Exception as e:
            logger.error(f"Failed to seed knowledge base: {e}")
            # We don't crash — chat will gracefully degrade to emergency numbers
    else:
        logger.info("Skipping knowledge-base seed (RAG_DISABLED or LITE_MODE).")

    # 3. Load OSM Routing Graph
    # This loads the ~25MB .graphml file into RAM
    # If it fails, the server still starts, but /route returns 503
    if not settings.LITE_MODE:
        try:
            from routing.graph_loader import load_graph
            load_graph()
        except Exception as e:
            logger.error(f"Failed to load routing graph: {e}")
    else:
        logger.info("Skipping routing graph load (LITE_MODE).")

    # 4. Sanity check — fail fast if a heavy ML module leaked into the
    # boot import graph. We only run this in RAG_DISABLED / LITE_MODE
    # because, well, the whole point of those flags is to NOT import
    # these.
    if settings.RAG_DISABLED or settings.LITE_MODE:
        _assert_no_heavy_modules()

    logger.info("SafeHer Backend ready for traffic.")
    yield
    logger.info("Shutting down SafeHer Backend...")


def _assert_no_heavy_modules() -> None:
    """
    Hard guard: if we're running in RAG_DISABLED / LITE_MODE, none of
    these heavy ML modules may have been imported by the time the
    lifespan finishes. If any of them is in sys.modules, the relevant
    boot-time chain was accidentally eager — log a loud warning so
    the next deploy doesn't OOM silently.
    """
    import sys
    forbidden = ("chromadb", "sentence_transformers", "google.generativeai", "groq", "networkx")
    leaked = [m for m in forbidden if m in sys.modules]
    if leaked:
        logger.warning(
            f"⚠ Heavy modules imported despite RAG_DISABLED/LITE_MODE: {leaked}. "
            f"This will inflate RAM on Render free tier — find the eager import "
            f"and move it inside the function that uses it."
        )
    else:
        logger.info(
            "✓ Boot import graph is clean: chromadb, sentence_transformers, "
            "google.generativeai, groq, networkx are all absent from sys.modules."
        )


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
