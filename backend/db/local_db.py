"""
SafeHer — Local SQLite Database Fallback
==========================================
Used when USE_SUPABASE is false. Stores incidents locally.
Ensures the app runs out-of-the-box without configuring API keys.
"""

import aiosqlite
import json
import logging
from datetime import datetime
from typing import Optional

from routing.safety_scorer import haversine_distance

logger = logging.getLogger("safeher.local_db")

DB_PATH = "data/safeher_local.db"


async def init_db():
    """Initialize the SQLite tables."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS emergency_contacts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                relation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                lat REAL,
                lng REAL,
                category TEXT,
                description TEXT,
                time_of_day TEXT,
                anonymous INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sos_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS circles (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#FF4D6D',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS circle_members (
                id TEXT PRIMARY KEY,
                circle_id TEXT NOT NULL,
                name TEXT NOT NULL,
                contact TEXT NOT NULL,
                relation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_circles_owner ON circles(owner_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_members_circle ON circle_members(circle_id)")
        await db.commit()
    logger.info("Local SQLite database initialized.")


async def insert_incident(data: dict):
    """Insert a single incident."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO incidents (id, lat, lng, category, description, time_of_day, anonymous)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data["id"], data["lat"], data["lng"], data["category"],
            data["description"], data["time_of_day"], int(data["anonymous"])
        ))
        await db.commit()


async def get_incidents_in_radius(lat: float, lng: float, radius_m: int, days_back: int) -> list:
    """
    Find incidents within radius.
    SQLite doesn't have spatial extensions by default, so we:
    1. Filter by a rough bounding box (fast)
    2. Compute exact haversine distance in Python (accurate)
    """
    # Rough bounding box (1 degree is ~111km)
    deg_offset = (radius_m / 111000) * 1.5
    min_lat, max_lat = lat - deg_offset, lat + deg_offset
    min_lng, max_lng = lng - deg_offset, lng + deg_offset

    results = []
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(f"""
            SELECT * FROM incidents
            WHERE lat BETWEEN ? AND ?
              AND lng BETWEEN ? AND ?
              AND created_at >= date('now', '-{days_back} days')
        """, (min_lat, max_lat, min_lng, max_lng))

        rows = await cursor.fetchall()

        for row in rows:
            dist = haversine_distance(lat, lng, row["lat"], row["lng"])
            if dist <= radius_m:
                results.append(dict(row))

    return results


async def insert_sos_log(data: dict):
    """Save raw SOS log as JSON."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO sos_logs (log_data) VALUES (?)",
            (json.dumps(data),)
        )
        await db.commit()


# --- Trusted Circles (local fallback) ---

async def insert_circle(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO circles (id, owner_id, name, color) VALUES (?, ?, ?, ?)",
            (data["id"], data["owner_id"], data["name"], data.get("color", "#FF4D6D")),
        )
        await db.commit()


async def list_circles_for_owner(owner_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT c.id, c.owner_id, c.name, c.color,
                   (SELECT COUNT(*) FROM circle_members m WHERE m.circle_id = c.id) AS member_count
            FROM circles c
            WHERE c.owner_id = ?
            ORDER BY c.created_at DESC
            """,
            (owner_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_circle_with_members(circle_id: str, owner_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        c = await (
            await db.execute(
                "SELECT id, owner_id, name, color FROM circles WHERE id = ? AND owner_id = ?",
                (circle_id, owner_id),
            )
        ).fetchone()
        if not c:
            return None
        m = await (
            await db.execute(
                "SELECT id, name, contact, relation FROM circle_members WHERE circle_id = ? ORDER BY created_at ASC",
                (circle_id,),
            )
        ).fetchall()
        return {
            "id": c["id"],
            "owner_id": c["owner_id"],
            "name": c["name"],
            "color": c["color"],
            "members": [dict(r) for r in m],
            "member_count": len(m),
        }


async def insert_circle_member(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO circle_members (id, circle_id, name, contact, relation) VALUES (?, ?, ?, ?, ?)",
            (data["id"], data["circle_id"], data["name"], data["contact"], data.get("relation")),
        )
        await db.commit()


async def delete_circle_member(member_id: str, circle_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM circle_members WHERE id = ? AND circle_id = ?",
            (member_id, circle_id),
        )
        await db.commit()


async def delete_circle_cascade(circle_id: str, owner_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "SELECT id FROM circles WHERE id = ? AND owner_id = ?",
            (circle_id, owner_id),
        )
        if not await cur.fetchone():
            return False
        await db.execute("DELETE FROM circle_members WHERE circle_id = ?", (circle_id,))
        await db.execute("DELETE FROM circles WHERE id = ?", (circle_id,))
        await db.commit()
        return True
