"""
SafeHer — Chat Service
=========================
Core logic for the RAG pipeline.

Flow:
  1. Preprocess query (detect lang, check emergency)
  2. If emergency → use fast-path retrieval (relaxed threshold)
  3. Else → standard RAG retrieval
  4. If no results → return 999 fallback (never hallucinate)
  5. Format context and system prompt
  6. Call LLM (Gemini by default; Groq if LLM_PROVIDER=groq)
  7. Return generated response

Provider selection:
  - Set LLM_PROVIDER=gemini (default) → uses GEMINI_API_KEY with gemini-2.0-flash.
    Strong Bengali/Banglish generation, fast, ~1500 free RPD on the free tier.
  - Set LLM_PROVIDER=groq          → uses GROQ_API_KEY with openai/gpt-oss-120b.
    Stronger reasoning, very fast inference, free preview tier.

Both clients are imported lazily. If the active provider's key is missing
or the client fails to initialise, we fall through to a graceful
emergency-only response — never a 500 to the user.
"""

import logging

from language.preprocessor import preprocess
from rag.retriever import retrieve_texts, retrieve_emergency
from core.config import get_settings

logger = logging.getLogger("safeher.chat_service")
settings = get_settings()

# Lazy clients — only build the one we'll use.
_groq_client = None
_gemini_client = None
_provider_warning_emitted = False


def _get_groq_client():
import os
import google.generativeai as genai

# Initialize Gemini client
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {e}")


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    if not settings.GEMINI_API_KEY:
        return None
    try:
        # gemini-2.0-flash: fast, free tier, strong Bengali.
        _gemini_client = genai.GenerativeModel("gemini-2.0-flash")
        logger.info("Gemini client initialised (provider=gemini)")
        return _gemini_client
    except Exception as e:
        logger.error(f"Failed to initialise Gemini client: {e}")
        return None


SYSTEM_PROMPT = """You are SafeHer, a calm, precise emergency safety guide for women in Bangladesh.

ABSOLUTE RULES — Violate none of these:
1. Answer ONLY using the facts from the CONTEXT passages below.
2. If the context does not contain the answer, you MUST respond EXACTLY with:
   Bengali: "এই তথ্য আমার কাছে নেই। এখনই ৯৯৯ কল করুন।"
   English: "I don't have that information. Call 999 now."
3. NEVER invent or guess phone numbers, addresses, laws, or names. A wrong number could cost a life.
4. Keep it short. Maximum 3 sentences. No bullet lists.
5. No pleasantries. No "hello", no "stay safe", no "I am an AI". Just the facts.
6. Match the user's language:
   - If they write Bengali script → reply in Bengali script
   - If they write Banglish (romanized) → reply in Bengali script (it is easier to read quickly)
   - If they write code-mixed → reply in Bengali script
   - If they write pure English → reply in English

CONTEXT:
{context}"""


async def generate_response(query: str) -> dict:
    """
    Generate an AI response using RAG.
    """
    # Step 1: Preprocess
    preprocessed = preprocess(query)
    logger.info(
        f"Chat request: lang={preprocessed.lang}, emergency={preprocessed.is_emergency}"
    )

    # Step 2: Retrieve context
    if preprocessed.is_emergency:
        passages = retrieve_emergency(query)
    else:
        passages = retrieve_texts(query)

    # Step 3: Retrieval-failure fallback (no LLM call needed)
    fallback_used = len(passages) == 0
    if fallback_used:
        logger.warning(f"No relevant passages found for query: {query[:50]}...")
        reply = "এই তথ্য আমার কাছে নেই। জরুরী সাহায্যের জন্য ৯৯৯ কল করুন।"
        if preprocessed.lang == "en":
            reply = "I don't have that information. Call 999 immediately."
        return {
            "reply": reply,
            "lang_detected": preprocessed.lang,
            "was_transliterated": preprocessed.was_transliterated,
            "fallback_used": True,
        }

    # Step 4: Format prompt
    context = "\n".join(f"[{i+1}] {p}" for i, p in enumerate(passages))
    system = SYSTEM_PROMPT.format(context=context)

    if preprocessed.is_emergency:
        system = (
            "CRITICAL EMERGENCY: The user is in danger or frightened. "
            "Your VERY FIRST sentence MUST be the appropriate emergency number (999 or 10921) "
            "followed by immediate action steps.\n\n"
        ) + system

    # Step 5: Generate
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system
        )
        
        response = await model.generate_content_async(
            contents=preprocessed.original,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=150,
                temperature=0.05,
                top_p=0.9,
            )
        )

        reply_text = response.text.strip()

        return {
            "reply": reply_text,
            "lang_detected": preprocessed.lang,
            "was_transliterated": preprocessed.was_transliterated,
            "fallback_used": False,
        }

    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        raise


async def _call_gemini(system: str, user_msg: str) -> str:
    client = _get_gemini_client()
    if client is None:
        raise RuntimeError("Gemini client not available (missing GEMINI_API_KEY or import failure)")
    response = await client.generate_content_async(
        contents=[{"role": "user", "parts": [{"text": system + "\n\nUser: " + user_msg}]}],
        generation_config={
            "max_output_tokens": 200,
            "temperature": 0.05,
            "top_p": 0.9,
        },
    )
    return response.text or ""