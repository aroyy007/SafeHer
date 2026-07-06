"""
SafeHer — Supabase Client
===========================
Singleton client for Supabase interactions.
"""

from core.config import get_settings

_supabase_client = None


def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client, Client
        settings = get_settings()

        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase URL and Key must be set in .env")

        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    return _supabase_client
