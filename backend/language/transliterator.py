"""
SafeHer — Banglish-to-Bengali Transliterator
===============================================
Converts romanized Bengali (Banglish) with the local ``avro.py`` phonetic
parser. The wrapper protects common non-Banglish spans and keeps the
existing preprocessing API unchanged.

Known limitations:
  - Ambiguous spellings (e.g., "bari" could be বাড়ি or বাড়ী)
  - Regional spelling variants not all covered
  - These are acceptable for a RAG retrieval context — the embedding
    model handles minor variations in the normalized Bengali
"""

import re
import logging
import unicodedata
from threading import Lock
from typing import List, Tuple

from language.detector import BANGLISH_PATTERNS

logger = logging.getLogger("safeher.transliterator")

try:
    from avro import parse as avro_parse
    from avro.main import _parse_backend as avro_parse_backend
except ImportError:
    # Keep chat available in environments that have not refreshed requirements.
    avro_parse = None
    avro_parse_backend = None
    logger.warning("avro.py is unavailable; using the legacy transliteration fallback")


# Legacy fallback used only if avro.py is unavailable. Keep the mapping
# ordered longest-first so the fallback does not break existing installs.

PHONETIC_MAP: List[Tuple[str, str]] = [
    # === 4-character sequences ===
    ("kkhh", "ক্খ"),
    ("ngng", "ঙ্ঙ"),
    ("ngyy", "ঞ্য"),

    # === 3-character sequences ===
    ("chh", "ছ"),
    ("ksh", "ক্ষ"),
    ("jjh", "ঝ"),
    ("ddh", "ড্ধ"),
    ("nng", "ঙ্গ"),
    ("shh", "শ্"),
    ("tth", "ত্থ"),

    # === 2-character sequences (digraphs) ===
    # Aspirated consonants
    ("kh", "খ"),
    ("gh", "ঘ"),
    ("ch", "চ"),
    ("jh", "ঝ"),
    ("th", "থ"),
    ("dh", "ধ"),
    ("ph", "ফ"),
    ("bh", "ভ"),

    # Retroflex (capital T/D in Avro)
    ("Th", "ঠ"),
    ("Dh", "ঢ"),
    ("Sh", "ষ"),
    ("Ng", "ঙ"),

    # Sibilants and nasals
    ("sh", "শ"),
    ("ng", "ং"),
    ("ny", "ঞ"),
    ("nk", "ঙ্ক"),

    # Vowel digraphs
    ("aa", "আ"),
    ("ii", "ঈ"),
    ("uu", "ঊ"),
    ("ee", "ঈ"),
    ("oo", "উ"),
    ("ou", "ঔ"),
    ("oi", "ঐ"),
    ("ri", "রি"),

    # === Single vowels ===
    ("a", "অ"),
    ("i", "ই"),
    ("u", "উ"),
    ("e", "এ"),
    ("o", "ও"),

    # === Single consonants ===
    ("k", "ক"),
    ("g", "গ"),
    ("c", "ক"),  # 'c' alone maps to ক (not চ — চ requires 'ch')
    ("j", "জ"),
    ("t", "ত"),
    ("d", "দ"),
    ("n", "ন"),
    ("p", "প"),
    ("b", "ব"),
    ("m", "ম"),
    ("r", "র"),
    ("l", "ল"),
    ("s", "স"),
    ("h", "হ"),
    ("f", "ফ"),
    ("v", "ভ"),
    ("w", "ও"),
    ("y", "য"),
    ("z", "জ"),
    ("q", "ক"),
    ("x", "ক্স"),
]

# Pattern to detect URLs
URL_PATTERN = re.compile(r'https?://\S+|www\.\S+', re.IGNORECASE)

# Pattern to detect pure numbers (including Bengali digits)
NUMBER_PATTERN = re.compile(r'^[\d\u09E6-\u09EF]+$')

# Pattern to detect email addresses
EMAIL_PATTERN = re.compile(r'\S+@\S+\.\S+')

TOKEN_PATTERN = re.compile(
    r'(?i:https?://\S+|www\.\S+)|\S+@\S+\.\S+'
    r'|\d+'
    r'|[\u0980-\u09FF]+'
    r"|[A-Za-z]+(?:['’-][A-Za-z]+)*"
    r'|\s+|.',
    re.DOTALL,
)

COMMON_ENGLISH = {
    "help", "safe", "unsafe", "danger", "police", "hospital",
    "phone", "call", "area", "road", "bus", "stop", "near",
    "here", "there", "please", "thank", "sorry", "yes", "no",
    "ok", "okay", "time", "place", "home", "school", "office",
    "market", "station", "number", "mobile", "online", "app",
}

# avro.py caches parsed input in an internal 128-entry LRU. Keep parsing
# serialized so its cache can be cleared before user text leaves this call.
_AVRO_PARSE_LOCK = Lock()


def _parse_with_avro(text: str) -> str:
    """Parse a Romanized span without retaining it in avro.py's cache."""
    if avro_parse is None or avro_parse_backend is None:
        return _apply_phonetic_rules(text.lower())

    with _AVRO_PARSE_LOCK:
        try:
            return avro_parse(text)
        except Exception:
            # Keep chat preprocessing available if the parser rejects a span.
            # Do not include the span or exception text in logs.
            logger.warning(
                "avro.py parsing failed; using the legacy transliteration fallback"
            )
            return _apply_phonetic_rules(text.lower())
        finally:
            cache_clear = getattr(avro_parse_backend, "cache_clear", None)
            if callable(cache_clear):
                cache_clear()
            else:
                raise RuntimeError("avro.py parser cache interface changed")


def _should_preserve_token(token: str, *, preserve_english: bool) -> bool:
    """Keep non-Banglish spans intact before sending a token to Avro parsing."""
    if URL_PATTERN.fullmatch(token) or EMAIL_PATTERN.fullmatch(token):
        return True
    if NUMBER_PATTERN.fullmatch(token) or re.search(r'[\u0980-\u09FF]', token):
        return True
    if token.isupper() and len(token) >= 2:
        return True
    if (
        token[0].isupper()
        and not token.isupper()
        and (
            token.lower() in COMMON_ENGLISH
            or not BANGLISH_PATTERNS.fullmatch(token)
        )
    ):
        return True
    if preserve_english and token.lower() in COMMON_ENGLISH:
        return True
    return False


def _transliterate_tokens(text: str, *, preserve_english: bool) -> str:
    """Parse contiguous Roman spans while retaining protected tokens and spacing."""
    result = []
    pending = []

    def flush_pending() -> None:
        if pending:
            result.append(_parse_with_avro("".join(pending)))
            pending.clear()

    for match in TOKEN_PATTERN.finditer(text):
        token = match.group()
        if re.fullmatch(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", token):
            if _should_preserve_token(token, preserve_english=preserve_english):
                flush_pending()
                result.append(token)
            else:
                pending.append(token)
        elif token.isspace():
            if pending:
                pending.append(token)
            else:
                result.append(token)
        elif len(token) == 1 and unicodedata.category(token).startswith("P"):
            if pending:
                pending.append(token)
            else:
                result.append(token)
        else:
            flush_pending()
            result.append(token)

    flush_pending()
    return "".join(result)


def transliterate_banglish(text: str) -> str:
    """
    Convert Banglish text with the local Avro phonetic parser.

    URLs, emails, numeric strings, acronyms, and likely proper names stay
    unchanged. The parser is deterministic; it does not resolve every
    ambiguous Roman spelling.
    """
    if not text or not text.strip():
        return text
    return _transliterate_tokens(text, preserve_english=False)


def _apply_phonetic_rules(text: str) -> str:
    """
    Apply phonetic mapping rules to a single lowercase word.
    Uses greedy longest-match-first replacement.
    """
    result = []
    i = 0

    while i < len(text):
        matched = False

        # Try longest match first (4 chars, 3 chars, 2 chars, 1 char)
        for length in (4, 3, 2, 1):
            if i + length <= len(text):
                chunk = text[i:i + length]
                # Search phonetic map
                for roman, bengali in PHONETIC_MAP:
                    if roman == chunk and len(roman) == length:
                        result.append(bengali)
                        i += length
                        matched = True
                        break
            if matched:
                break

        if not matched:
            # Character not in phonetic map — pass through (digit, special char)
            result.append(text[i])
            i += 1

    return "".join(result)


def transliterate_mixed(text: str) -> str:
    """
    Handle code-mixed text: transliterate only the Banglish portions,
    keep Bengali script and English unchanged.

    Preserve Bengali script and the existing common-English allowlist; parse
    the remaining Roman tokens locally.
    """
    if not text or not text.strip():
        return text
    return _transliterate_tokens(text, preserve_english=True)
