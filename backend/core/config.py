"""
SafeHer Backend — Configuration
================================
Loads all settings from .env via Pydantic Settings.
Feature flags allow running without Supabase/Firebase for local development.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field
import os


class Settings(BaseSettings):
    """
    All configuration loaded from environment variables.
    Defaults are set for local development — override in .env or Render dashboard.
    """

    # --- API Keys ---
    GEMINI_API_KEY: str = Field(default="", description="Gemini API key for LLM inference")
    GROQ_API_KEY: str = Field(default="", description="Groq API key for LLM inference (llama / gpt-oss)")
    HUGGINGFACE_API_KEY: str = Field(default="", description="HuggingFace API key for model downloads")
    LLM_PROVIDER: str = Field(
        default="gemini",
        description="Which LLM to use: 'gemini' or 'groq'. Gemini wins by default.",
    )

    # --- Supabase ---
    USE_SUPABASE: bool = Field(default=False, description="Enable Supabase for incident storage")
    SUPABASE_URL: str = Field(default="", description="Supabase project URL")
    SUPABASE_KEY: str = Field(default="", description="Supabase publishable / anon key (browser-safe)")
    SUPABASE_SERVICE_KEY: str = Field(
        default="",
        description=(
            "Supabase SERVICE ROLE key (backend only, bypasses RLS). "
            "If empty, falls back to SUPABASE_KEY — set this on Render for production."
        ),
    )
    SUPABASE_JWT_SECRET: str = Field(
        default="",
        description=(
            "Supabase JWT Secret (HS256) for verifying access tokens. "
            "Find it at Project Settings → API → JWT Secret."
        ),
    )

    # --- Firebase ---
    USE_FIREBASE: bool = Field(default=False, description="Enable Firebase for SOS tracking")
    FIREBASE_CREDENTIALS_BASE64: str = Field(default="", description="Base64 encoded Firebase service account JSON")

    # --- Server ---
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    DEBUG: bool = Field(default=True)

    # --- CORS ---
    # Comma-separated list of allowed origins. Empty / "*" falls back
    # to the dev defaults in main.py._build_allowed_origins().
    ALLOWED_ORIGINS: str = Field(
        default="",
        description="Comma-separated CORS allow-list (e.g. 'https://safeher.app,https://staging.safeher.app')",
    )

    # --- Feature Flags ---
    ENABLE_BENGALI_EMBEDDER: bool = Field(
        default=True,
        description="Use l3cube Bengali SBERT. Set False to fall back to all-MiniLM-L6-v2"
    )
    LITE_MODE: bool = Field(
        default=True,
        description=(
            "Skip heavy startup tasks (Bengali SBERT load + ChromaDB seeding). "
            "Defaults to True so the backend boots safely on Render free tier "
            "(512MB RAM) without env-var config. Set to False on Render Standard "
            "($7/mo) or any environment with ≥2GB RAM. See BACKEND_DEPLOY.md §A.3."
        ),
    )
    RAG_DISABLED: bool = Field(
        default=True,
        description=(
            "Disable ChromaDB + SBERT at runtime too. /chat sends queries "
            "directly to Gemini (with Groq fallback) using a baked-in "
            "bilingual safety knowledge base in the system prompt. "
            "Defaults to True so the backend boots safely on Render free "
            "tier. Set to False on Render Standard or any environment "
            "where you want full retrieval-augmented chat. See "
            "BACKEND_DEPLOY.md §A.3."
        ),
    )
    GRAPH_PATH: str = Field(
        default="data/chittagong_walk.graphml",
        description="Path to precomputed graph file"
    )
    CHROMA_PATH: str = Field(
        default="./chroma_store",
        description="Path to ChromaDB persistent storage"
    )

    # --- Email (SOS alert fallback) ---
    SMTP_HOST: str = Field(default="", description="Optional SMTP host for /sos/alert fallback")
    SMTP_PORT: int = Field(default=587, description="SMTP port (587 for TLS, 465 for SSL)")
    SMTP_USER: str = Field(default="", description="SMTP username")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password / app password")
    SMTP_FROM: str = Field(default="", description="From address used when SMTP is enabled")

    # --- Rate Limits ---
    MAX_INCIDENTS_PER_HOUR: int = Field(default=10, description="Max incident reports per session per hour")
    MAX_CHAT_QUERY_LENGTH: int = Field(default=1000, description="Max characters in a chat query")
    MAX_NEARBY_RADIUS_M: int = Field(default=5000, description="Max radius for nearby incident queries")

    # --- Bangladesh Bounding Box ---
    BD_LAT_MIN: float = Field(default=20.5)
    BD_LAT_MAX: float = Field(default=26.7)
    BD_LNG_MIN: float = Field(default=88.0)
    BD_LNG_MAX: float = Field(default=92.7)

    # --- Chittagong Center (for defaults) ---
    CTG_CENTER_LAT: float = Field(default=22.3569)
    CTG_CENTER_LNG: float = Field(default=91.7832)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """
    Singleton settings instance. Cached after first call.
    The lru_cache ensures .env is read only once.
    """
    return Settings()
