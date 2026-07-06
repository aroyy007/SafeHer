"""
SafeHer — Language Detector
=============================
Detects whether user input is:
  - bn        : Pure Bengali script (অ-ঃ, ক-হ)
  - banglish  : Romanized Bengali ("amake bachao", "eta ki safe?")
  - code_mixed: Bengali script mixed with English words
  - en        : Pure English
  - unknown   : Too short or ambiguous

Detection order matters critically:
1. Check Bengali Unicode chars FIRST — definitive signal
2. Check Banglish keyword patterns in roman script
3. Fall back to langdetect for ambiguous cases
4. Default to English — safe fallback since the LLM handles English natively

The Banglish pattern list includes 70+ common words drawn from actual
Bangladeshi social media and messaging patterns.
"""

import re
from typing import Optional

try:
    from langdetect import detect, LangDetectException
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False


class LanguageType:
    """Language type constants."""
    BENGALI = "bn"
    BANGLISH = "banglish"
    CODE_MIXED = "code_mixed"
    ENGLISH = "en"
    UNKNOWN = "unknown"


# Bengali Unicode block: U+0980 to U+09FF
BENGALI_UNICODE_RANGE = re.compile(r'[\u0980-\u09FF]')

# Comprehensive Banglish keyword patterns
# Organized by category for maintainability
_BANGLISH_PRONOUNS = (
    "ami|tumi|apni|tui|amra|tomra|apnara|amake|tomake|apnake|"
    "amar|tomar|apnar|oder|tar|se|ora|tara"
)
_BANGLISH_VERBS = (
    "ache|hobe|koro|kori|korbo|korte|lagbe|dao|din|jai|jabo|jete|"
    "thako|thakbo|theke|bolo|bolun|bolte|jani|janina|janben|"
    "paro|parbo|parben|chai|chao|chaile|dekho|dekhun|dekhte|"
    "shuno|shunun|shunbe|eso|asho|ashun|asben|"
    "khao|khaite|khabe|likhte|likhun|poro|porun|"
    "bhalo|valo|kharap|boro|choto|sundor|"
    "bachao|help|danger|safe|call|phone"
)
_BANGLISH_COMMON = (
    "ki|ke|keno|kothay|kokhon|kivabe|kemon|kon|"
    "emon|ekhane|ekhon|okhane|okhon|sekhane|"
    "khub|onek|ektu|kichu|shob|shobai|"
    "na|ha|nah|haan|ji|jee|"
    "boro|choto|valo|kharap|bipad|voy|bhoy|"
    "bari|ghor|rastay|rasta|police|hospital|doctor|"
    "dhorecho|maarse|uthao|dhorlam|chharlo"
)
_BANGLISH_SAFETY = (
    "bachao|bacha|sahajjo|sahayya|bipod|bipad|"
    "dara|darao|thamun|thamo|choro|chhoro|"
    "maarse|dhorche|tanche|"
    "ekla|eka|raat|raate|andhar|andhokare"
)

BANGLISH_PATTERNS = re.compile(
    r'\b(' + '|'.join([_BANGLISH_PRONOUNS, _BANGLISH_VERBS,
                       _BANGLISH_COMMON, _BANGLISH_SAFETY]) + r')\b',
    re.IGNORECASE
)

# Minimum 3-char English words (to distinguish from Banglish fragments)
ENGLISH_WORD_PATTERN = re.compile(r'[a-zA-Z]{3,}')


def detect_language(text: str) -> str:
    """
    Detect the language/script of user input text.

    Args:
        text: Raw user input string

    Returns:
        One of: 'bn', 'banglish', 'code_mixed', 'en', 'unknown'

    Edge cases:
        - Empty/whitespace-only → 'unknown'
        - Single emoji → 'unknown'
        - Numbers only → 'unknown'
        - "999" → 'unknown' (but caller should handle emergency numbers separately)
    """
    if not text or not text.strip():
        return LanguageType.UNKNOWN

    text = text.strip()

    # Very short text (1-2 chars) — unreliable detection
    if len(text) < 2:
        return LanguageType.UNKNOWN

    has_bengali_script = bool(BENGALI_UNICODE_RANGE.search(text))
    has_english_words = bool(ENGLISH_WORD_PATTERN.search(text))

    # Count Banglish matches
    banglish_matches = BANGLISH_PATTERNS.findall(text)
    has_banglish = len(banglish_matches) >= 1

    # --- Decision tree ---

    # Case 1: Has Bengali script characters
    if has_bengali_script:
        if has_english_words:
            # Bengali script + English words = code-mixed
            return LanguageType.CODE_MIXED
        else:
            # Pure Bengali script
            return LanguageType.BENGALI

    # Case 2: No Bengali script — check for Banglish patterns
    if has_banglish:
        # Count ratio of Banglish words to total words
        words = text.split()
        if len(words) > 0:
            banglish_ratio = len(banglish_matches) / len(words)
            if banglish_ratio >= 0.2:  # At least 20% Banglish words
                return LanguageType.BANGLISH

    # Case 3: No Bengali, no clear Banglish — try langdetect
    if HAS_LANGDETECT:
        try:
            detected = detect(text)
            if detected == "bn":
                return LanguageType.BENGALI
            elif detected == "en":
                return LanguageType.ENGLISH
            else:
                # Other languages — treat as English (safe fallback)
                return LanguageType.ENGLISH
        except (LangDetectException, Exception):
            pass

    # Case 4: Default — treat as English (LLM handles English natively)
    if has_english_words:
        return LanguageType.ENGLISH

    return LanguageType.UNKNOWN


def is_emergency_query(text: str) -> bool:
    """
    Quick check if the query contains urgent distress signals.
    Used before full language processing for fast-path emergency responses.

    This checks BOTH scripts and romanized forms.
    """
    text_lower = text.lower()

    # Bengali emergency words
    bengali_emergency = [
        "বাঁচাও", "সাহায্য", "বিপদ", "ভয়", "ধরেছে", "মারছে",
        "আক্রমণ", "ছিনতাই", "অনুসরণ", "পিছু", "ধরে", "টানছে",
        "জরুরী", "৯৯৯", "পুলিশ"
    ]

    # Banglish / English emergency words
    roman_emergency = [
        "help", "bachao", "bacha", "danger", "scared", "following",
        "attack", "grab", "hurt", "trapped", "emergency", "bipad",
        "voy", "bhoy", "dhore", "dhorche", "maarse", "maarche",
        "kidnap", "rape", "assault", "save me", "amake bachao",
        "police", "999", "sos"
    ]

    # Check Bengali
    for word in bengali_emergency:
        if word in text:
            return True

    # Check romanized
    for word in roman_emergency:
        if word in text_lower:
            return True

    return False
