"""
SafeHer — Direct (No-RAG) Chat Service
========================================
Production path that bypasses ChromaDB and SBERT entirely.

Used when RAG_DISABLED=true (e.g. Render free tier, where loading the
Bengali SBERT model + ChromaDB seeds eats 512 MB and OOM-kills the
worker). The bilingual safety knowledge base is baked directly into
the system prompt so the LLM still gives grounded answers — we just
lose per-query embedding-based retrieval.

Why this works:
  - The KB is small (~40 verified facts) so it fits in a single system
    prompt without exceeding any LLM's context window.
  - Gemini 1.5/2.0 series and Groq llama-3.3-70b both handle Bengali +
    English + Banglish natively and respect the "answer only from
    context" rule just fine.

If RAG_DISABLED is false we still defer to chat_service.generate_response
(which uses ChromaDB + SBERT) — this module is only imported when RAG
is off.
"""

import asyncio
import logging
from typing import Optional

from rag.seed_data import KNOWLEDGE_BASE

logger = logging.getLogger("safeher.direct_chat")


def _build_kb_block() -> str:
    """
    Render the bilingual KB as a compact, deduplicated text block for
    inclusion in the LLM system prompt. Pairs every Bengali entry with
    its English counterpart in the same category.
    """
    # Group by category for readability
    by_cat: dict = {}
    for e in KNOWLEDGE_BASE:
        by_cat.setdefault(e["category"], []).append(e)

    parts = []
    for cat, entries in by_cat.items():
        parts.append(f"## {cat}")
        # Pair bn + en so the LLM sees both languages for the same fact
        bn = [e["text"] for e in entries if e.get("lang") == "bn"]
        en = [e["text"] for e in entries if e.get("lang") == "en"]
        for i in range(max(len(bn), len(en))):
            if i < len(bn):
                parts.append(f"  [BN] {bn[i]}")
            if i < len(en):
                parts.append(f"  [EN] {en[i]}")
        parts.append("")
    return "\n".join(parts)


# Cached at module import — building it is ~3 ms, but the LLM doesn't
# need to wait for it on every request anyway.
_KB_BLOCK: str = _build_kb_block()


SYSTEM_PROMPT_DIRECT = f"""You are SafeHer, a calm, precise emergency safety guide for women in Bangladesh.

ABSOLUTE RULES — Violate none of these:
1. Answer ONLY using the facts from the KNOWLEDGE BASE block below.
2. If the knowledge base does not contain the answer, you MUST respond EXACTLY with:
   Bengali: "এই তথ্য আমার কাছে নেই। এখনই ৯৯৯ কল করুন।"
   English: "I don't have that information. Call 999 now."
3. NEVER invent or guess phone numbers, addresses, laws, or names. A wrong number could cost a life.
4. Keep it short. Maximum 3 sentences. No bullet lists.
5. No pleasantries. No "hello", no "stay safe", no "I am an AI". Just the facts.
6. Match the user's language:
   - Bengali script → reply in Bengali script
   - Banglish (romanized) → reply in Bengali script (it is easier to read quickly)
   - code-mixed → reply in Bengali script
   - pure English → reply in English

KNOWLEDGE BASE (Bengali [BN] + English [EN]):
{_KB_BLOCK}"""


async def _call_gemini(system: str, user_msg: str) -> str:
    """Direct Gemini call — no retrieval layer."""
    import google.generativeai as genai

    from core.config import get_settings
    s = get_settings()
    if not s.GEMINI_API_KEY:
        raise RuntimeError("gemini_no_api_key")

    genai.configure(api_key=s.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-lite",
        system_instruction=system,
    )

    try:
        response = await asyncio.wait_for(
            model.generate_content_async(
                contents=user_msg,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=300,
                    temperature=0.1,
                    top_p=0.9,
                ),
            ),
            timeout=12.0,
        )
    except asyncio.TimeoutError:
        raise RuntimeError("gemini_timeout")

    try:
        candidate = response.candidates[0] if response.candidates else None
        finish = int(candidate.finish_reason) if candidate else 1
    except Exception:
        finish = 1

    try:
        reply_text = (response.text or "").strip()
    except ValueError:
        reply_text = ""

    if finish not in (0, 1):
        reply_text = (reply_text + " [truncated]").strip() if reply_text else ""
    return reply_text


async def _call_groq(system: str, user_msg: str) -> str:
    """Direct Groq call (used as automatic fallback if Gemini fails)."""
    import groq

    from core.config import get_settings
    s = get_settings()
    if not s.GROQ_API_KEY:
        raise RuntimeError("groq_no_api_key")

    client = groq.Groq(api_key=s.GROQ_API_KEY)

    def _call():
        return client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=300,
            temperature=0.1,
            top_p=0.9,
            timeout=12.0,
        )

    response = await asyncio.to_thread(_call)
    choice = response.choices[0] if response.choices else None
    if not choice:
        raise RuntimeError("groq_empty_response")
    return (choice.message.content or "").strip()


async def generate_direct_response(query: str) -> dict:
    """
    Generate a chat reply using ONLY Gemini (with Groq fallback) and
    the baked-in KB. Never touches ChromaDB or SBERT.

    Mirrors the shape of chat_service.generate_response so the router
    can use either one interchangeably.
    """
    from core.config import get_settings
    from language.preprocessor import preprocess

    settings = get_settings()

    pre = preprocess(query)
    logger.info(f"Direct-chat: lang={pre.lang}, emergency={pre.is_emergency}")

    # Emergency-prefix the system prompt — same shape as chat_service.
    system = SYSTEM_PROMPT_DIRECT
    if pre.is_emergency:
        system = (
            "CRITICAL EMERGENCY: The user is in danger or frightened. "
            "Your VERY FIRST sentence MUST be the appropriate emergency "
            "number (999 or 10921) followed by immediate action steps.\n\n"
        ) + system

    last_err: Optional[Exception] = None

    # Resolution order: explicit LLM_PROVIDER → Gemini → Groq.
    # Same as chat_service._init_provider but inline so we don't import
    # chromadb/sentence_transformers transitively.
    preferred = (settings.LLM_PROVIDER or "").lower().strip()

    attempts = []
    if preferred == "groq":
        attempts = ["groq", "gemini"]
    elif preferred == "gemini":
        attempts = ["gemini", "groq"]
    else:
        # Auto-detect (Gemini first if key present)
        attempts = ["gemini", "groq"]

    for provider in attempts:
        try:
            if provider == "gemini":
                if not settings.GEMINI_API_KEY:
                    continue
                reply = await _call_gemini(system, pre.normalized)
            else:
                if not settings.GROQ_API_KEY:
                    continue
                reply = await _call_groq(system, pre.normalized)

            if not reply:
                raise RuntimeError(f"{provider}_empty_response")
            return {
                "reply": reply,
                "lang_detected": pre.lang,
                "was_transliterated": pre.was_transliterated,
                "fallback_used": False,
                "provider": provider,
                "rag_disabled": True,
            }
        except Exception as e:
            last_err = e
            logger.error(f"Direct-chat {provider} failed: {e}")
            continue

    raise RuntimeError(f"All direct-chat providers failed: {last_err}")
