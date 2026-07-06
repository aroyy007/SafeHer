"""
SafeHer — Bengali Text Normalizer
====================================
Wrapper around the csebuetnlp/normalizer package.

This handles:
  - Unicode normalization (NFC form)
  - Zero-width character removal (ZWJ, ZWNJ where inappropriate)
  - Hasanta (্) fixes
  - Punctuation normalization (Bengali vs ASCII variants)
  - Numeral unification (Bengali ০-৯ ↔ ASCII 0-9)

IMPORTANT: This must run AFTER transliteration, BEFORE embedding.
Never embed raw Bengali text without normalization — the tokenizer
will produce inconsistent representations for identical words.

Graceful degradation: if csebuetnlp/normalizer is not installed,
falls back to basic Unicode NFC normalization. The app still works,
just with slightly lower embedding quality.
"""

import unicodedata
import re
import logging

logger = logging.getLogger("safeher.normalizer")

# Try to import the csebuetnlp normalizer
try:
    from normalizer import normalize as bn_normalize
    HAS_CSEBUETNLP_NORMALIZER = True
    logger.info("csebuetnlp/normalizer loaded successfully")
except ImportError:
    HAS_CSEBUETNLP_NORMALIZER = False
    logger.warning(
        "csebuetnlp/normalizer not installed. Using basic Unicode normalization. "
        "Install with: pip install git+https://github.com/csebuetnlp/normalizer"
    )


# Basic Bengali cleanup patterns (used as fallback)
ZERO_WIDTH_CHARS = re.compile(r'[\u200b\u200c\u200d\u200e\u200f\ufeff]')
MULTIPLE_SPACES = re.compile(r'\s+')
BENGALI_DIGIT_MAP = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')


def normalize_bengali(text: str) -> str:
    """
    Normalize Bengali text for consistent embedding.

    Args:
        text: Bengali (or transliterated Bengali) text

    Returns:
        Normalized text string

    Behavior:
        - If csebuetnlp/normalizer is available: uses full normalization pipeline
        - If not: applies basic Unicode NFC + zero-width cleanup
        - On ANY error: returns original text unchanged (graceful degradation)
    """
    if not text or not text.strip():
        return text

    try:
        if HAS_CSEBUETNLP_NORMALIZER:
            return bn_normalize(text)
        else:
            return _basic_normalize(text)
    except Exception as e:
        logger.warning(f"Normalization failed for text [{text[:50]}...]: {e}")
        return text  # Always return something — never crash


def _basic_normalize(text: str) -> str:
    """
    Basic Bengali normalization fallback when csebuetnlp is unavailable.

    Steps:
    1. Unicode NFC normalization (compose characters)
    2. Remove zero-width characters
    3. Normalize whitespace
    4. Strip leading/trailing whitespace
    """
    # Step 1: Unicode NFC
    text = unicodedata.normalize('NFC', text)

    # Step 2: Remove zero-width characters
    text = ZERO_WIDTH_CHARS.sub('', text)

    # Step 3: Normalize whitespace
    text = MULTIPLE_SPACES.sub(' ', text)

    # Step 4: Strip
    text = text.strip()

    return text


def normalize_for_display(text: str) -> str:
    """
    Light normalization for display purposes (not for embedding).
    Preserves formatting but fixes common Unicode issues.
    """
    if not text:
        return text

    # NFC normalize
    text = unicodedata.normalize('NFC', text)

    # Remove zero-width chars except ZWNJ (which affects display)
    text = re.sub(r'[\u200b\u200d\u200e\u200f\ufeff]', '', text)

    return text.strip()
