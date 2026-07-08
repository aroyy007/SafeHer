"""
SafeHer — Trusted Circles API
================================
Endpoints (all prefixed /circles):
  POST   /                        — create a circle
  GET    /                        — list all circles for the current owner
  GET    /{circle_id}             — get a single circle with members
  POST   /{circle_id}/members     — add a member to a circle
  DELETE /{circle_id}/members/{id} — remove a member
  DELETE /{circle_id}             — delete a circle (cascade)

Auth model:
  Primary:  Authorization: Bearer <Supabase JWT>     (production)
  Fallback: X-Session-Id: <uuid>                    (local dev / demo)

  When a Supabase JWT is present, we extract the user_id from the
  `sub` claim and use that as the owner_id. Otherwise we fall back to
  the X-Session-Id header so the demo still works without Supabase.

All operations are ownership-checked: a different owner cannot read
or mutate your circles.
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Header, HTTPException, Request

from pydantic import BaseModel, Field, field_validator

from services.circles_service import (
    create_circle,
    list_circles,
    get_circle,
    add_member,
    remove_member,
    delete_circle,
)
from db.supabase_client import verify_supabase_jwt
from services.auth_service import verify_token as verify_legacy_token

logger = logging.getLogger("safeher.router.circles")

router = APIRouter(prefix="/circles", tags=["circles"])


# ----- Schemas -----

class CreateCircleBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class CircleOut(BaseModel):
    id: str
    owner_id: str
    name: str
    color: str
    member_count: int = 0


class MemberBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    contact: str = Field(..., min_length=3, max_length=120, description="Phone, email, or other handle")
    relation: Optional[str] = Field(default=None, max_length=40)

    @field_validator("contact")
    @classmethod
    def basic_contact_check(cls, v: str) -> str:
        # Reject obviously malformed contacts
        v = v.strip()
        if not v:
            raise ValueError("contact cannot be empty")
        # Allow phone numbers, emails, or anything that doesn't contain HTML
        if "<" in v or ">" in v or "\"" in v:
            raise ValueError("invalid characters in contact")
        return v


class MemberOut(BaseModel):
    id: str
    name: str
    contact: str
    relation: Optional[str] = None


def _resolve_owner_id(
    authorization: Optional[str],
    x_session_id: Optional[str],
) -> str:
    """
    Resolve the current owner_id from either a Supabase JWT (preferred)
    or the legacy X-Session-Id header. Returns the user id string, or
    raises 401.
    """
    # 1) Supabase JWT path
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        sub = verify_supabase_jwt(token)
        if sub:
            return sub

    # 2) Legacy HMAC token path (still passes through verify_token)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        uid = verify_legacy_token(token)
        if uid:
            return uid

    # 3) Fallback: X-Session-Id header (hackathon dev mode)
    if x_session_id and x_session_id.strip():
        sid = x_session_id.strip()
        if 8 <= len(sid) <= 128:
            return sid

    raise HTTPException(status_code=401, detail="Missing or invalid auth")


def _owner_id(x_session_id: Optional[str]) -> str:
    """Backwards-compatible helper used by routes that take only X-Session-Id."""
    if not x_session_id or not x_session_id.strip():
        raise HTTPException(status_code=401, detail="Missing X-Session-Id header")
    sid = x_session_id.strip()
    if len(sid) < 8 or len(sid) > 128:
        raise HTTPException(status_code=401, detail="Invalid X-Session-Id")
    return sid


# ----- Routes -----

@router.post("/", status_code=201, response_model=CircleOut)
async def post_circle(
    body: CreateCircleBody,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """Create a new trusted circle."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    circle = await create_circle(owner_id, body.name, body.color)
    return CircleOut(
        id=circle["id"],
        owner_id=circle["owner_id"],
        name=circle["name"],
        color=circle.get("color", "#FF4D6D"),
        member_count=0,
    )


@router.get("/", response_model=List[CircleOut])
async def get_circles(
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """List all circles owned by the current owner."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    rows = await list_circles(owner_id)
    return [
        CircleOut(
            id=r["id"],
            owner_id=r["owner_id"],
            name=r["name"],
            color=r.get("color", "#FF4D6D"),
            member_count=r.get("member_count", 0),
        )
        for r in rows
    ]


@router.get("/{circle_id}")
async def get_circle_detail(
    circle_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """Get one circle, including all members."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    circle = await get_circle(circle_id, owner_id)
    if not circle:
        raise HTTPException(status_code=404, detail="circle_not_found")
    return {
        "id": circle["id"],
        "owner_id": circle["owner_id"],
        "name": circle["name"],
        "color": circle.get("color", "#FF4D6D"),
        "members": circle.get("members", []),
        "member_count": circle.get("member_count", 0),
    }


@router.post("/{circle_id}/members", status_code=201, response_model=MemberOut)
async def post_member(
    circle_id: str,
    body: MemberBody,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """Add a member to a circle you own."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    result = await add_member(circle_id, owner_id, body.name, body.contact, body.relation)
    if isinstance(result, dict) and result.get("error") == "circle_not_found":
        raise HTTPException(status_code=404, detail="circle_not_found")
    return MemberOut(
        id=result["id"],
        name=result["name"],
        contact=result["contact"],
        relation=result.get("relation"),
    )


@router.delete("/{circle_id}/members/{member_id}")
async def delete_member(
    circle_id: str,
    member_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """Remove a member from a circle you own."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    result = await remove_member(circle_id, owner_id, member_id)
    if not result.get("removed"):
        raise HTTPException(status_code=404, detail="circle_or_member_not_found")
    return {"removed": True}


@router.delete("/{circle_id}")
async def delete_circle_endpoint(
    circle_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
):
    """Delete a circle (and cascade its members)."""
    owner_id = _resolve_owner_id(authorization, x_session_id)
    result = await delete_circle(circle_id, owner_id)
    if not result.get("deleted"):
        raise HTTPException(status_code=404, detail="circle_not_found")
    return {"deleted": True}