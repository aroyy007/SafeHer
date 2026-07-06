"""
SafeHer — Trusted Circles Service
====================================
Stores user-defined trusted circles: each circle has an owner and
0..N members (typically phone numbers / emails of friends & family
who get SOS alerts).

Storage:
  - If USE_SUPABASE=true → uses Supabase tables `circles` + `circle_members`.
  - Otherwise → uses local SQLite (data/safeher_local.db) for the demo.

This is a CRUD service; the alert-dispatch side lives in the frontend
(EmailJS) because that gives us phone-call/SMS fallback for free.
"""

import logging
import uuid
from typing import Dict, Any, List, Optional

from core.config import get_settings

logger = logging.getLogger("safeher.circles_service")
settings = get_settings()


async def create_circle(owner_id: str, name: str, color: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new trusted circle owned by `owner_id`.
    Returns the new circle's id and metadata.
    """
    circle_id = str(uuid.uuid4())
    payload = {
        "id": circle_id,
        "owner_id": owner_id,
        "name": name,
        "color": color or "#FF4D6D",
    }

    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        res = supabase.table("circles").insert(payload).execute()
        if res.data:
            return res.data[0]
        return payload

    # Local SQLite fallback
    from db.local_db import insert_circle
    await insert_circle(payload)
    return payload


async def list_circles(owner_id: str) -> List[Dict[str, Any]]:
    """List all circles owned by a user (with member counts)."""
    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        res = supabase.table("circles").select("*, circle_members(id)").eq("owner_id", owner_id).execute()
        circles = res.data or []
        for c in circles:
            c["member_count"] = len(c.pop("circle_members") or [])
        return circles

    from db.local_db import list_circles_for_owner
    return await list_circles_for_owner(owner_id)


async def get_circle(circle_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    """Get one circle (with full member list) — verifies ownership."""
    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        res = (
            supabase.table("circles")
            .select("*, circle_members(*)")
            .eq("id", circle_id)
            .eq("owner_id", owner_id)
            .execute()
        )
        if not res.data:
            return None
        circle = res.data[0]
        members = circle.pop("circle_members") or []
        circle["members"] = members
        circle["member_count"] = len(members)
        return circle

    from db.local_db import get_circle_with_members
    return await get_circle_with_members(circle_id, owner_id)


async def add_member(
    circle_id: str, owner_id: str, name: str, contact: str, relation: Optional[str] = None
) -> Dict[str, Any]:
    """Add a member to a circle. Refuses if `owner_id` doesn't own the circle."""
    member_id = str(uuid.uuid4())
    payload = {
        "id": member_id,
        "circle_id": circle_id,
        "name": name,
        "contact": contact,
        "relation": relation,
    }

    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        # Verify ownership first
        own = supabase.table("circles").select("id").eq("id", circle_id).eq("owner_id", owner_id).execute()
        if not own.data:
            return {"error": "circle_not_found", "circle_id": circle_id}
        res = supabase.table("circle_members").insert(payload).execute()
        return res.data[0] if res.data else payload

    from db.local_db import insert_circle_member, get_circle_with_members
    circle = await get_circle_with_members(circle_id, owner_id)
    if not circle:
        return {"error": "circle_not_found", "circle_id": circle_id}
    await insert_circle_member(payload)
    return payload


async def remove_member(circle_id: str, owner_id: str, member_id: str) -> Dict[str, Any]:
    """Remove a member from a circle (ownership-checked)."""
    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        own = (
            supabase.table("circles")
            .select("id")
            .eq("id", circle_id)
            .eq("owner_id", owner_id)
            .execute()
        )
        if not own.data:
            return {"removed": False, "error": "circle_not_found"}
        supabase.table("circle_members").delete().eq("id", member_id).eq("circle_id", circle_id).execute()
        return {"removed": True}

    from db.local_db import delete_circle_member, get_circle_with_members
    circle = await get_circle_with_members(circle_id, owner_id)
    if not circle:
        return {"removed": False, "error": "circle_not_found"}
    await delete_circle_member(member_id, circle_id)
    return {"removed": True}


async def delete_circle(circle_id: str, owner_id: str) -> Dict[str, Any]:
    """Delete a circle and all its members (cascade)."""
    if settings.USE_SUPABASE:
        from db.supabase_client import get_supabase
        supabase = get_supabase()
        own = (
            supabase.table("circles")
            .select("id")
            .eq("id", circle_id)
            .eq("owner_id", owner_id)
            .execute()
        )
        if not own.data:
            return {"deleted": False, "error": "circle_not_found"}
        supabase.table("circle_members").delete().eq("circle_id", circle_id).execute()
        supabase.table("circles").delete().eq("id", circle_id).execute()
        return {"deleted": True}

    from db.local_db import delete_circle_cascade
    ok = await delete_circle_cascade(circle_id, owner_id)
    return {"deleted": ok}