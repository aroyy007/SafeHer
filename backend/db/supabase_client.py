"""
SafeHer — Supabase Client
===========================
Singleton clients for Supabase interactions.

There are TWO clients in production:

  get_supabase()       — uses the publishable / anon key.
                         Safe to expose to the browser, but RLS-restricted.
                         Use this on the frontend; rarely needed on the backend.

  get_supabase_admin() — uses the SERVICE ROLE key.
                         Bypasses RLS. NEVER expose to the browser.
                         Use this on the backend for trusted writes
                         (insert SOS events, write user profiles, etc.).

The service role key is read from SUPABASE_SERVICE_KEY in .env. If it is
not set, get_supabase_admin() falls back to SUPABASE_KEY (which is what
hackathon deployments were using before) and logs a warning so the team
knows to fix the env.
"""

import logging
from core.config import get_settings

logger = logging.getLogger("safeher.supabase")

_supabase_anon = None
_supabase_admin = None


def get_supabase():
    """Anon-key client. For browser-safe reads. RLS still applies."""
    global _supabase_anon
    if _supabase_anon is None:
        from supabase import create_client
        settings = get_settings()

        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase URL and Key must be set in .env")

        _supabase_anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase_anon


def get_supabase_admin():
    """Service-role client. Bypasses RLS. Backend only.

    Reads SUPABASE_SERVICE_KEY first; if absent, falls back to SUPABASE_KEY
    and warns. Set SUPABASE_SERVICE_KEY on Render for production.
    """
    global _supabase_admin
    if _supabase_admin is None:
        from supabase import create_client
        settings = get_settings()

        if not settings.SUPABASE_URL:
            raise ValueError("SUPABASE_URL must be set in .env")

        key = (settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY or "").strip()
        if not key:
            raise ValueError("SUPABASE_SERVICE_KEY (or SUPABASE_KEY) must be set in .env")

        if not settings.SUPABASE_SERVICE_KEY:
            logger.warning(
                "SUPABASE_SERVICE_KEY is not set — falling back to SUPABASE_KEY. "
                "For backend writes, set SUPABASE_SERVICE_KEY in Render env vars."
            )

        _supabase_admin = create_client(settings.SUPABASE_URL, key)
    return _supabase_admin


# ============================================================
# Supabase Auth — JWT verification
# ============================================================
#
# Frontend signs the user in with supabase.auth.signInWithPassword()
# (or signUp / phone OTP) and gets a JWT access_token. It then attaches
# the token as `Authorization: Bearer <access_token>` on every API call.
#
# The backend verifies the JWT using the Supabase JWT secret (HS256).
# We do not need a network round-trip — verification is local & fast.
#
# For the hackathon, the existing HMAC token (X-Session-Id style) is
# still honored as a fallback so local-only dev keeps working without
# Supabase configuration. Production should disable the fallback.

import os
import time
import hmac
import hashlib
import base64
import json
from typing import Optional


def _b64url_decode(s: str) -> bytes:
    """Decode base64url without padding (JWT uses this)."""
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def verify_supabase_jwt(token: str) -> Optional[str]:
    """
    Verify a Supabase access_token JWT and return the user id (sub claim)
    if valid, else None.

    Supabase issues HS256 JWTs signed with the project's JWT secret.
    The secret is shown in Supabase Dashboard → Project Settings → API
    → "JWT Secret" (legacy field). Newer Supabase projects may use a
    signing key (ES256) — for hackathon purposes we support HS256 only.

    Token payload schema (Supabase):
      {
        "sub":  "<user uuid>",
        "email": "...",
        "exp":  <unix seconds>,
        "iat":  <unix seconds>,
        "aud":  "authenticated",
        "role": "authenticated"
      }
    """
    if not token or not isinstance(token, str):
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        if header.get("alg") not in ("HS256",):
            return None

        settings = get_settings()
        secret = (settings.SUPABASE_JWT_SECRET or "").strip()
        if not secret:
            return None

        # Recompute signature
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        try:
            provided = _b64url_decode(sig_b64)
        except Exception:
            return None
        if not hmac.compare_digest(expected, provided):
            return None

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        # Check expiry
        exp = int(payload.get("exp") or 0)
        if exp and int(time.time()) > exp:
            return None
        # Check role
        if payload.get("aud") and payload.get("aud") != "authenticated":
            return None
        return payload.get("sub")
    except Exception:
        return None
