"""
SafeHer — Chat Router (RAG API)
=================================
Endpoint: POST /chat

Handles user queries to the AI safety assistant.
Never returns a 500 error — safety-critical endpoint.
Falls back to hardcoded emergency numbers if anything fails.
"""

import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from services.chat_service import generate_response
from core.exceptions import EMERGENCY_FALLBACK
from core.rate_limiter import chat_rate_limit

logger = logging.getLogger("safeher.router.chat")

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat API Request Schema"""
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="User's query (Bengali, Banglish, or English)",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Optional session ID for tracking/context",
    )


class ChatResponse(BaseModel):
    """Chat API Response Schema"""
    reply: str = Field(..., description="AI response text")
    lang_detected: str = Field(..., description="Detected input language")
    was_transliterated: bool = Field(..., description="True if Banglish was converted")
    fallback_used: bool = Field(..., description="True if retrieval failed")


@router.post(
    "/",
    response_model=ChatResponse,
    dependencies=[Depends(chat_rate_limit())],
)
async def chat_endpoint(request: ChatRequest):
    """
    RAG Chat Endpoint.

    Process:
      1. Preprocesses query (detect lang, transliterate Banglish, normalize)
      2. Retrieves facts from ChromaDB
      3. Passes facts + query to LLM (Gemini default; Groq if configured)
      4. Returns structured, verified response

    Safety: capped at 30 queries/min/session and NEVER returns 500 —
    any upstream failure degrades to EMERGENCY_FALLBACK with the
    999 / 10921 numbers.
    """
    # Quick sanitize
    query = request.query.strip()
    if not query:
        return ChatResponse(**EMERGENCY_FALLBACK)

    try:
        result = await generate_response(query)
        return ChatResponse(**result)

    except Exception as e:
        logger.error(f"Chat endpoint failure: {e}", exc_info=True)
        return ChatResponse(**EMERGENCY_FALLBACK)
