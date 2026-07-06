"""
SafeHer — Auth Router
=========================
Endpoints for signup, login, and managing emergency contacts.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr

from services.auth_service import (
    create_user, authenticate_user, generate_token, verify_token,
    get_user_by_id, add_emergency_contact, get_emergency_contacts, delete_emergency_contact
)

logger = logging.getLogger("safeher.router.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


# --- Schemas ---
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ContactRequest(BaseModel):
    name: str
    phone: str
    email: str = ""
    relation: str = "Friend"

# --- Dependencies ---
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ")[1]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Routes ---
@router.post("/signup")
async def signup(req: SignupRequest):
    try:
        user = await create_user(req.name, req.email, req.phone, req.password)
        token = generate_token(user["id"])
        return {"token": token, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(req: LoginRequest):
    user = await authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = generate_token(user["id"])
    
    # Don't return password hash
    user.pop("password_hash", None)
    return {"token": token, "user": user}

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    contacts = await get_emergency_contacts(user["id"])
    return {"user": user, "contacts": contacts}

@router.post("/contacts")
async def create_contact(req: ContactRequest, user: dict = Depends(get_current_user)):
    contact = await add_emergency_contact(user["id"], req.name, req.phone, req.email, req.relation)
    return contact

@router.delete("/contacts/{contact_id}")
async def remove_contact(contact_id: str, user: dict = Depends(get_current_user)):
    success = await delete_emergency_contact(contact_id, user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}
