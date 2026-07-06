"""
SafeHer — Language Preprocessor (Orchestrator)
================================================
Entry point for ALL user text before it reaches the LLM or embeddings.

Pipeline:
  1. Detect language (bn / banglish / code_mixed / en / unknown)
  2. If Banglish → transliterate to Bengali script
  3. If Bengali or transliterated → apply BanglaBERT normalization
  4. If English → pass through unchanged
  5. If code-mixed → normalize Bengali portions, keep English

Returns a PreprocessedText object containing:
  - original: raw user input (for display and prompt context)
  - normalized: processed text (for embedding and retrieval)
  - lang: detected language type
  - was_transliterated: whether Banglish→Bengali conversion happened
  - is_emergency: whether danger signals were detected
"""

from dataclasses import dataclass
from language.detector import detect_language, is_emergency_query, LanguageType
from language.transliterator import transliterate_banglish, transliterate_mixed
from language.normalizer import normalize_bengali


@dataclass
class PreprocessedText:
    """Result of the full preprocessing pipeline."""
    original: str           # Raw user input
    normalized: str         # Processed text for embedding/retrieval
    lang: str              # Detected language type
    was_transliterated: bool  # True if Banglish was converted
    is_emergency: bool     # True if danger signals detected


def preprocess(text: str) -> PreprocessedText:
    """
    Full preprocessing pipeline for user input text.

    This is the ONLY function external code should call.
    All language detection, transliteration, and normalization
    happens here in the correct order.

    Args:
        text: Raw user input string

    Returns:
        PreprocessedText with both original and normalized versions

    Edge cases:
        - Empty string → returns with original="" and lang="unknown"
        - Pure numbers → returns unchanged with lang="unknown"
        - Emoji-only → returns unchanged with lang="unknown"
        - Very long text → processed normally (length validation is caller's job)
    """
    if not text or not text.strip():
        return PreprocessedText(
            original=text or "",
            normalized=text or "",
            lang=LanguageType.UNKNOWN,
            was_transliterated=False,
            is_emergency=False,
        )

    text = text.strip()

    # Step 0: Check for emergency signals (fast path, before language detection)
    emergency = is_emergency_query(text)

    # Step 1: Detect language
    lang = detect_language(text)
    was_transliterated = False

    # Step 2: Language-specific processing
    if lang == LanguageType.BANGLISH:
        # Transliterate Banglish to Bengali script, then normalize
        transliterated = transliterate_banglish(text)
        normalized = normalize_bengali(transliterated)
        was_transliterated = True

    elif lang == LanguageType.BENGALI:
        # Pure Bengali → normalize only
        normalized = normalize_bengali(text)

    elif lang == LanguageType.CODE_MIXED:
        # Mixed script → transliterate Banglish portions, normalize Bengali
        transliterated = transliterate_mixed(text)
        normalized = normalize_bengali(transliterated)
        was_transliterated = True  # Partially transliterated

    elif lang == LanguageType.ENGLISH:
        # English → pass through (LLM handles English natively)
        normalized = text

    else:
        # Unknown → pass through
        normalized = text

    return PreprocessedText(
        original=text,
        normalized=normalized,
        lang=lang,
        was_transliterated=was_transliterated,
        is_emergency=emergency,
    )


def preprocess_for_embedding(text: str) -> str:
    """
    Convenience function: preprocess and return only the normalized text.
    Used internally by the RAG seeder to normalize knowledge base entries.
    """
    result = preprocess(text)
    return result.normalized
