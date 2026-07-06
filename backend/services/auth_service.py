"""
SafeHer — Auth Service
=========================
Simple local authentication for hackathon purposes.
Uses hashlib for password hashing and simple token generation.
"""

import hashlib
import hmac
import secrets
import aiosqlite
import uuid
import time
import os
from typing import Optional

from db.local_db import DB_PATH
from services.disposable_domains import is_disposable

# SECRET_KEY is loaded lazily so that tests / scripts can override it
# via environment variables without importing this module first.

def _get_secret_key() -> str:
    key = os.environ.get("SAFEHER_SECRET_KEY", "").strip()
    if key:
        return key
    # Fallback for local hackathon dev only. In production, .env MUST
    # set SAFEHER_SECRET_KEY to a long random string. We log a warning
    # so it's obvious if someone forgot to configure it.
    import logging
    logging.getLogger("safeher.auth").warning(
        "SAFEHER_SECRET_KEY not set — using insecure default. "
        "Set it in backend/.env for any non-local environment."
    )
    return "safeher-hackathon-super-secret-DO-NOT-USE-IN-PROD"

def _get_password_salt() -> str:
    salt = os.environ.get("SAFEHER_PASSWORD_SALT", "").strip()
    if salt:
        return salt
    return "safeher_salt_"


def hash_password(password: str) -> str:
    """Hash password with sha256 + per-deployment salt."""
    salt = _get_password_salt()
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_token(user_id: str) -> str:
    """Generate a token embedding user ID and expiry, signed with HMAC."""
    expiry = int(time.time()) + (7 * 24 * 60 * 60)  # 7 days
    payload = f"{user_id}.{expiry}"
    signature = hmac.new(
        _get_secret_key().encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"{payload}.{signature}"

def verify_token(token: str) -> Optional[str]:
    """Returns user_id if valid, else None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        user_id, expiry, signature = parts

        if int(time.time()) > int(expiry):
            return None

        expected_sig = hmac.new(
            _get_secret_key().encode(), f"{user_id}.{expiry}".encode(), hashlib.sha256
        ).hexdigest()
        if secrets.compare_digest(signature, expected_sig):
            return user_id
    except Exception:
        pass
    return None


MIN_PASSWORD_LEN = 8

def _validate_signup_inputs(name: str, email: str, phone: str, password: str) -> None:
    """Raise ValueError with a user-friendly message if any input is bad."""
    if not name or not name.strip():
        raise ValueError("Name is required")
    if not email or not email.strip():
        raise ValueError("Email is required")
    if is_disposable(email):
        raise ValueError(
            "Disposable / temporary email addresses are not allowed. "
            "Please use a permanent email so we can contact you in an emergency."
        )
    if not phone or not phone.strip():
        raise ValueError("Phone number is required")
    if len(password or "") < MIN_PASSWORD_LEN:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LEN} characters")
    if password and password.strip() == password and password.isdigit():
        # Reject all-numeric passwords like "12345678"
        raise ValueError("Password cannot be entirely numeric")


async def create_user(name: str, email: str, phone: str, password: str) -> dict:
    _validate_signup_inputs(name, email, phone, password)

    # Normalize email so duplicate detection is case-insensitive.
    email_norm = email.strip().lower()
    user_id = str(uuid.uuid4())
    pwd_hash = hash_password(password)

    async with aiosqlite.connect(DB_PATH) as db:
        # Check for existing user case-insensitively (SQLite's default
        # LIKE/= is binary, so we normalize manually).
        cur = await db.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?", (email_norm,)
        )
        existing = await cur.fetchone()
        if existing:
            raise ValueError("Email already registered")

        try:
            await db.execute(
                "INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
                (user_id, name.strip(), email_norm, phone.strip(), pwd_hash)
            )
            await db.commit()
        except aiosqlite.IntegrityError:
            raise ValueError("Email already registered")
    return {"id": user_id, "name": name.strip(), "email": email_norm, "phone": phone.strip()}

async def authenticate_user(email: str, password: str) -> Optional[dict]:
    if not email or not password:
        return None
    email_norm = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM users WHERE LOWER(email) = ?", (email_norm,)
        )
        row = await cur.fetchone()

        if row and verify_password(password, row["password_hash"]):
            return dict(row)
    return None

async def get_user_by_id(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT id, name, email, phone FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
        return dict(row) if row else None

# Emergency Contacts
async def add_emergency_contact(user_id: str, name: str, phone: str, email: str, relation: str) -> dict:
    contact_id = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO emergency_contacts (id, user_id, name, phone, email, relation) VALUES (?, ?, ?, ?, ?, ?)",
            (contact_id, user_id, name, phone, email, relation)
        )
        await db.commit()
    return {"id": contact_id, "user_id": user_id, "name": name, "phone": phone, "email": email, "relation": relation}

async def get_emergency_contacts(user_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM emergency_contacts WHERE user_id = ?", (user_id,))
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

async def delete_emergency_contact(contact_id: str, user_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?", (contact_id, user_id))
        await db.commit()
        return cur.rowcount > 0