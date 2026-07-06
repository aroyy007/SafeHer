"""
SafeHer — Auth Service
=========================
Simple local authentication for hackathon purposes.
Uses hashlib for password hashing and simple token generation.
"""

import hashlib
import secrets
import aiosqlite
import uuid
import time
from typing import Optional

from db.local_db import DB_PATH

SECRET_KEY = "safeher-hackathon-super-secret"  # Good enough for hackathon

def hash_password(password: str) -> str:
    """Hash password with sha256 + salt."""
    salt = "safeher_salt_"
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_token(user_id: str) -> str:
    """Generate a very simple token embedding user ID and expiry."""
    # format: user_id.expiry.signature
    expiry = int(time.time()) + (7 * 24 * 60 * 60) # 7 days
    payload = f"{user_id}.{expiry}"
    signature = hashlib.hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
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
            
        expected_sig = hashlib.hmac.new(SECRET_KEY.encode(), f"{user_id}.{expiry}".encode(), hashlib.sha256).hexdigest()
        if secrets.compare_digest(signature, expected_sig):
            return user_id
    except:
        pass
    return None

async def create_user(name: str, email: str, phone: str, password: str) -> dict:
    user_id = str(uuid.uuid4())
    pwd_hash = hash_password(password)
    
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
                (user_id, name, email, phone, pwd_hash)
            )
            await db.commit()
            return {"id": user_id, "name": name, "email": email, "phone": phone}
        except aiosqlite.IntegrityError:
            raise ValueError("Email already registered")

async def authenticate_user(email: str, password: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM users WHERE email = ?", (email,))
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
