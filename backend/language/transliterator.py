"""
SafeHer — Banglish-to-Bengali Transliterator
===============================================
Converts romanized Bengali (Banglish) to Bengali script using
phonetic rules based on the Avro keyboard standard.

Reference: github.com/shuaib128/Banglish — Avro phonetic rules.

Design decisions:
  - Rule-based, NOT ML-based → faster, zero RAM cost, deterministic
  - Longest-match-first ordering prevents partial replacements
  - English proper nouns (capitalized) and numbers pass through
  - URLs and email addresses pass through unchanged

Known limitations:
  - Ambiguous spellings (e.g., "bari" could be বাড়ি or বাড়ী)
  - Regional spelling variants not all covered
  - These are acceptable for a RAG retrieval context — the embedding
    model handles minor variations in the normalized Bengali
"""

import re
from typing import List, Tuple


# =====================================================
# PHONETIC MAPPING TABLE
# =====================================================
# CRITICAL: Ordered by LENGTH (longest first).
# This prevents "sh" from matching before "shh",
# or "k" from matching before "kh".
# =====================================================

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


def transliterate_banglish(text: str) -> str:
    """
    Convert Banglish (romanized Bengali) to Bengali script.

    Args:
        text: Banglish text string

    Returns:
        Bengali script string with English proper nouns preserved

    Edge cases handled:
        - "Help amake" → "Help অমঅকএ" (Help stays as English)
        - "999 call koro" → "999 কঅল করও"
        - "https://google.com bachao" → "https://google.com বঅচঅও"
        - Empty string → empty string
    """
    if not text or not text.strip():
        return text

    # Extract and protect URLs
    urls = {}
    url_placeholder_idx = 0
    for match in URL_PATTERN.finditer(text):
        placeholder = f"__URL{url_placeholder_idx}__"
        urls[placeholder] = match.group()
        text = text.replace(match.group(), placeholder, 1)
        url_placeholder_idx += 1

    # Extract and protect emails
    emails = {}
    email_placeholder_idx = 0
    for match in EMAIL_PATTERN.finditer(text):
        placeholder = f"__EMAIL{email_placeholder_idx}__"
        emails[placeholder] = match.group()
        text = text.replace(match.group(), placeholder, 1)
        email_placeholder_idx += 1

    words = text.split()
    result = []

    for word in words:
        # Skip placeholders
        if word.startswith("__URL") or word.startswith("__EMAIL"):
            result.append(word)
            continue

        # Skip pure numbers
        if NUMBER_PATTERN.match(word):
            result.append(word)
            continue

        # Skip English proper nouns (Title Case or ALL CAPS with 3+ chars)
        if len(word) >= 2 and (word[0].isupper() and not word.isupper()):
            result.append(word)
            continue

        # Skip ALL CAPS words (acronyms like "SOS", "FIR", "NGO")
        if word.isupper() and len(word) >= 2:
            result.append(word)
            continue

        # Strip trailing punctuation, transliterate, re-attach
        trailing_punct = ""
        clean_word = word
        while clean_word and clean_word[-1] in ".,!?;:।'\"()-":
            trailing_punct = clean_word[-1] + trailing_punct
            clean_word = clean_word[:-1]

        leading_punct = ""
        while clean_word and clean_word[0] in "'\"(-":
            leading_punct += clean_word[0]
            clean_word = clean_word[1:]

        if not clean_word:
            result.append(word)
            continue

        # Apply phonetic transliteration
        converted = _apply_phonetic_rules(clean_word.lower())
        result.append(leading_punct + converted + trailing_punct)

    output = " ".join(result)

    # Restore URLs and emails
    for placeholder, url in urls.items():
        output = output.replace(placeholder, url)
    for placeholder, email in emails.items():
        output = output.replace(placeholder, email)

    return output


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

    Uses a simple heuristic: if a word contains Bengali Unicode, keep it.
    If it looks like an English word (in common English list), keep it.
    Otherwise, transliterate.
    """
    import re
    bengali_pattern = re.compile(r'[\u0980-\u09FF]')

    # Common English words that might appear in code-mixed Bangladeshi text
    common_english = {
        "help", "safe", "unsafe", "danger", "police", "hospital",
        "phone", "call", "area", "road", "bus", "stop", "near",
        "here", "there", "please", "thank", "sorry", "yes", "no",
        "ok", "okay", "time", "place", "home", "school", "office",
        "market", "station", "number", "mobile", "online", "app",
    }

    words = text.split()
    result = []

    for word in words:
        clean = word.strip(".,!?;:।'\"()-")

        # Keep Bengali script words
        if bengali_pattern.search(word):
            result.append(word)
        # Keep recognized English words
        elif clean.lower() in common_english:
            result.append(word)
        # Keep proper nouns
        elif word[0].isupper() if word else False:
            result.append(word)
        # Keep numbers
        elif clean.isdigit():
            result.append(word)
        # Transliterate the rest
        else:
            result.append(transliterate_banglish(word))

    return " ".join(result)
