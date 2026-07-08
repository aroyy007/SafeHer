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
  6. Call configured LLM (Gemini default; Groq fallback when LLM_PROVIDER=groq
     or Gemini quota is exhausted)
  7. Return generated response
"""

import asyncio
import logging
from typing import Optional

from language.preprocessor import preprocess
from rag.retriever import retrieve_texts, retrieve_emergency
from core.config import get_settings

logger = logging.getLogger("safeher.chat_service")
settings = get_settings()


def _init_provider():
    """
    Return a tuple (provider_name, callable) for the active LLM.

    Provider resolution order:
      1. settings.LLM_PROVIDER (explicit override — use this for Groq)
      2. Otherwise default to Gemini if key present, else Groq if key present.

    The returned callable has signature:
        async def generate(system: str, user_msg: str) -> str
    It raises on upstream failure; the chat endpoint catches and falls back.
    """
    provider = (settings.LLM_PROVIDER or "").lower().strip()

    # --- Explicit override path ---
    if provider == "groq":
        return _make_groq_provider()
    if provider == "gemini":
        return _make_gemini_provider()

    # --- Auto-detect ---
    if settings.GEMINI_API_KEY:
        return _make_gemini_provider()
    if settings.GROQ_API_KEY:
        return _make_groq_provider()

    raise RuntimeError(
        "No LLM provider available. Set GEMINI_API_KEY or GROQ_API_KEY in .env."
    )


def _make_gemini_provider():
    """Return ('gemini', async_fn) using the deprecated google.generativeai SDK."""
    import google.generativeai as genai  # lazy import — saves startup if unused

    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini provider ready")

    async def generate(system: str, user_msg: str) -> str:
        # gemini-2.5-flash-lite does NOT spend output budget on internal
        # "thinking" tokens the way gemini-2.5-flash does. Using flash
        # produces MAX_TOKENS-truncated replies. Flash-lite gives full,
        # deterministic, low-latency replies.
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            system_instruction=system,
        )

        # Hard ceiling — don't let a slow Gemini response stall the server.
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
            raise RuntimeError("gemini_timeout") from None

        # Safe extraction: NEVER call response.text before checking
        # finish_reason. response.text raises ValueError on non-STOP
        # finishes (MAX_TOKENS / SAFETY / RECITATION / OTHER).
        try:
            candidate = response.candidates[0] if response.candidates else None
            finish = int(candidate.finish_reason) if candidate else 1
        except Exception:
            finish = 1  # Default to STOP — let response.text try

        try:
            reply_text = (response.text or "").strip()
        except ValueError:
            reply_text = ""

        # 0=UNSPECIFIED, 1=STOP, 2=SAFETY, 3=RECITATION, 4=OTHER, 5=MAX_TOKENS
        if finish not in (0, 1):
            logger.warning(f"Gemini finish_reason={finish}, reply may be truncated")
            reply_text = (reply_text + " [truncated]").strip() if reply_text else ""

        return reply_text

    return ("gemini", generate)


def _make_groq_provider():
    """Return ('groq', async_fn) using the official Groq Python SDK (openai-style)."""
    import groq  # lazy import — saves startup if unused

    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY not set")

    client = groq.Groq(api_key=settings.GROQ_API_KEY)
    # llama-3.3-70b-versatile is on Groq's free preview tier with generous limits.
    # Switch to "openai/gpt-oss-120b" if you'd rather use the OpenAI-OSS model.
    model_name = "llama-3.3-70b-versatile"
    logger.info(f"Groq provider ready (model={model_name})")

    async def generate(system: str, user_msg: str) -> str:
        # Groq SDK is sync; run in a thread to avoid blocking the event loop.
        def _call():
            return client.chat.completions.create(
                model=model_name,
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
        finish = (choice.finish_reason or "stop").lower()
        # 'stop' and 'length' are normal; 'length' just means we hit max_tokens.
        # 'content_filter' / 'tool_calls' / None mean the model did not produce text.
        if finish not in ("stop", "length"):
            logger.warning(f"Groq finish_reason={finish}")
            raise RuntimeError(f"groq_finish:{finish}")
        content = (choice.message.content or "").strip()
        if not content:
            raise RuntimeError("groq_empty_content")
        return content

    return ("groq", generate)


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
    """Generate an AI response using RAG."""
    # Step 1: Preprocess
    preprocessed = preprocess(query)
    logger.info(f"Chat request: lang={preprocessed.lang}, emergency={preprocessed.is_emergency}")

    # Step 1.5: LITE_MODE short-circuit (Render free tier).
    # When LITE_MODE is on we skip the Bengali SBERT embedder + ChromaDB
    # entirely and return a deterministic, helpful canned reply. Keeps the
    # endpoint up so /sos, /route, and /incidents still work during the demo.
    if settings.LITE_MODE:
        if preprocessed.is_emergency:
            reply = (
                "এখনই ৯৯৯ কল করুন। নিরাপদ স্থানে যান এবং বিশ্বস্ত কাউকে জানান।\n\n"
                "(SafeHer is in lite mode on this server — full Bengali knowledge base is offline. "
                "For non-emergency questions, run the backend locally.)"
            )
            if preprocessed.lang == "en":
                reply = (
                    "Call 999 now. Move to a safe place and tell someone you trust.\n\n"
                    "(SafeHer is in lite mode on this server — full Bengali knowledge base is offline. "
                    "Run the backend locally for non-emergency questions.)"
                )
        else:
            reply = (
                "SafeHer is in lite mode on this server, so I can't search the full Bengali "
                "knowledge base right now. If this is an emergency, call 999 immediately. "
                "Otherwise, run the backend locally for full answers."
            )
        return {
            "reply": reply,
            "lang_detected": preprocessed.lang,
            "was_transliterated": preprocessed.was_transliterated,
            "fallback_used": True,
            "lite_mode": True,
        }

    # Step 2: Retrieve context. We run the embedding + ChromaDB query in
    # a thread so the FastAPI event loop stays free to serve /sos and
    # /incidents concurrently with /chat.
    if preprocessed.is_emergency:
        passages = await asyncio.to_thread(retrieve_emergency, query)
    else:
        passages = await asyncio.to_thread(retrieve_texts, query)

    # Step 3: Retrieval-failure fallback (no LLM call needed)
    if len(passages) == 0:
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

    # Step 5: Generate via configured provider.
    # Resolution order: explicit LLM_PROVIDER → Gemini (if key present) → Groq.
    # If a query is the SECOND or later call to fail on Gemini quota and
    # Groq is also configured, we transparently fall over to Groq so the
    # demo doesn't break when one provider 429s mid-presentation.
    last_error: Optional[Exception] = None

    for try_groq_fallback in (False, True):
        try:
            if try_groq_fallback:
                if not settings.GROQ_API_KEY:
                    break  # No Groq key — give up
                provider_name, gen_fn = _make_groq_provider()
                logger.warning("Falling back to Groq after Gemini failure")
            else:
                provider_name, gen_fn = _init_provider()

            reply_text = await gen_fn(system, preprocessed.original)

            # If the model handed us something but it's clearly truncated
            # or empty, treat as failure so the next iteration / fallback runs.
            if not reply_text:
                raise RuntimeError(f"{provider_name}_empty_response")

            return {
                "reply": reply_text,
                "lang_detected": preprocessed.lang,
                "was_transliterated": preprocessed.was_transliterated,
                "fallback_used": False,
                "provider": provider_name,
            }
        except Exception as e:
            last_error = e
            logger.error(f"LLM call failed ({provider_name}): {e}")
            # Only retry once on Gemini
            if provider_name != "gemini" or try_groq_fallback:
                break

    # If we get here, every provider failed. Re-raise so the router can
    # emit the EMERGENCY_FALLBACK safety response.
    raise RuntimeError(f"All LLM providers failed: {last_error}")