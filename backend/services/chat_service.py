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
  6. Call Gemini 2.5 Flash
  7. Return generated response
"""

import asyncio
import logging
import google.generativeai as genai

from language.preprocessor import preprocess
from rag.retriever import retrieve_texts, retrieve_emergency
from core.config import get_settings

logger = logging.getLogger("safeher.chat_service")
settings = get_settings()

# Configure Gemini once at module load
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini API configured")
else:
    logger.warning("GEMINI_API_KEY is empty — chat will degrade to emergency fallback")


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

    # Step 5: Generate via Gemini
    try:
        # gemini-2.5-flash-lite does NOT spend output budget on internal
        # "thinking" tokens the way gemini-2.5-flash does. Using flash
        # produces MAX_TOKENS-truncated replies (e.g. "Call 01"). Flash-lite
        # gives full, deterministic, low-latency replies.
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            system_instruction=system,
        )

        # Hard ceiling — don't let a slow Gemini response stall the server.
        # google.generativeai's generate_content_async is a real coroutine,
        # so asyncio.wait_for is the right primitive.
        try:
            response = await asyncio.wait_for(
                model.generate_content_async(
                    contents=preprocessed.original,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=300,
                        temperature=0.1,
                        top_p=0.9,
                    ),
                ),
                timeout=12.0,
            )
        except asyncio.TimeoutError:
            logger.error("Gemini call timed out after 12s — degrading to fallback")
            raise RuntimeError("gemini_timeout") from None

        # Safe extraction: NEVER call response.text before checking
        # finish_reason. response.text raises ValueError on non-STOP
        # finishes (MAX_TOKENS / SAFETY / RECITATION / OTHER).
        try:
            candidate = response.candidates[0] if response.candidates else None
            finish = int(candidate.finish_reason) if candidate else 1
        except Exception:
            finish = 1  # Default to STOP — let response.text try

        reply_text = ""
        try:
            reply_text = (response.text or "").strip()
        except ValueError as e:
            logger.warning(f"response.text raised (finish_reason={finish}): {e}")
            reply_text = ""

        # If Gemini hit MAX_TOKENS (truncated), append a brief guard so the
        # user always sees complete safety advice.
        # 0=UNSPECIFIED, 1=STOP, 2=SAFETY, 3=RECITATION, 4=OTHER, 5=MAX_TOKENS
        if finish not in (0, 1):
            logger.warning(f"Gemini finish_reason={finish}, reply may be truncated")
            if not reply_text:
                # Nothing came through at all — return safety fallback
                if preprocessed.lang == "en":
                    reply_text = "I'm having trouble responding right now. Call 999 if you need help."
                else:
                    reply_text = "আমি এখন সাহায্য করতে পারছি না। ৯৯৯ কল করুন।"
            else:
                if preprocessed.lang == "en":
                    reply_text = (reply_text + " If unsure, call 999 now.").strip()
                else:
                    reply_text = (reply_text + " ৯৯৯ কল করুন।").strip()

        return {
            "reply": reply_text,
            "lang_detected": preprocessed.lang,
            "was_transliterated": preprocessed.was_transliterated,
            "fallback_used": False,
        }

    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        raise