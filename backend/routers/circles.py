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
  All operations require the authenticated SafeHer account. X-Session-Id
  is not an identity credential and cannot be used to claim circle ownership.

All operations are ownership-checked: a different owner cannot read
or mutate your circles.
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field, field_validator

from services.circles_service import (
    create_circle,
    list_circles,
    get_circle,
    add_member,
    remove_member,
    delete_circle,
)
from routers.auth import get_current_user

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


# ----- Routes -----

@router.post("/", status_code=201, response_model=CircleOut)
async def post_circle(
    body: CreateCircleBody,
    user: dict = Depends(get_current_user),
):
    """Create a new trusted circle."""
    owner_id = user["id"]
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
    user: dict = Depends(get_current_user),
):
    """List all circles owned by the current owner."""
    owner_id = user["id"]
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
    user: dict = Depends(get_current_user),
):
    """Get one circle, including all members."""
    owner_id = user["id"]
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
    user: dict = Depends(get_current_user),
):
    """Add a member to a circle you own."""
    owner_id = user["id"]
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
    user: dict = Depends(get_current_user),
):
    """Remove a member from a circle you own."""
    owner_id = user["id"]
    result = await remove_member(circle_id, owner_id, member_id)
    if not result.get("removed"):
        raise HTTPException(status_code=404, detail="circle_or_member_not_found")
    return {"removed": True}


@router.delete("/{circle_id}")
async def delete_circle_endpoint(
    circle_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a circle (and cascade its members)."""
    owner_id = user["id"]
    result = await delete_circle(circle_id, owner_id)
    if not result.get("deleted"):
        raise HTTPException(status_code=404, detail="circle_not_found")
    return {"deleted": True}