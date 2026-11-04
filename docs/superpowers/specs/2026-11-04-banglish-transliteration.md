# Banglish transliteration design

## Goal

Improve SafeHer's Romanized Bengali chat preprocessing by replacing character-by-character substitutions with the existing `avro.py` Avro phonetic parser. Keep chat APIs and `PreprocessedText` unchanged, and do not send user text to a hosted transliteration service.

## Current behavior and impact

`backend/language/preprocessor.py` calls `transliterate_banglish` for romanized Bengali and `transliterate_mixed` for Bengali-script mixed input. The resulting `normalized` text is used by direct chat and RAG retrieval. Emergency detection runs against the raw query before transliteration. The current transliterator maps each Roman character independently, producing malformed words.

## Approaches

1. **Integrate `avro.py` (chosen):** pin `avro.py==2025.11.3` and call its whole-string parser behind the existing transliterator functions. This has no runtime dependencies beyond the package, supports Python 3.12, stays local, and preserves the current API. Its exception dictionary is incomplete and it transliterates some proper names, so SafeHer will continue protecting URLs, email addresses, numbers, acronyms, Bengali-script spans, and the existing English tokens in mixed-script input. It uses an internal 128-entry LRU cache for raw strings; the wrapper will clear that cache after each parse so chat text is not retained there.
2. **Use a local Hugging Face model:** better sentence context is possible, but the public Bengali-focused artifact is about 245 MB and needs a PyTorch/Transformers runtime; this does not fit the default 512 MB Lite Mode comfortably. The smaller 24 MB model requires accepting a gate that shares Hugging Face account information.
3. **Keep or replace with another rules package:** a pure Python package is light, but candidates reviewed either have weaker provenance/maintenance or remain a small rule map rather than a full-string Avro parser.

`avro.py` is selected because it directly addresses the malformed character-wise output while fitting the current lightweight Python backend. The package is distributed under MIT OR Apache-2.0; no model artifacts or external APIs are added.

## Proposed behavior

- Keep `transliterate_banglish(text)` and `transliterate_mixed(text)` signatures and preserve `preprocess()` output fields.
- Parse contiguous Romanized spans with `avro.parse`; preserve URL, email, numeric, acronym, Bengali, likely proper-name, and recognized English spans as currently intended.
- Clear the package parser's input cache in a `finally` block after parsing. Keep the clear call serialized with a lock so concurrent worker-thread requests cannot leave another query in the cache after completion.
- If the package is missing or rejects a span, use the existing lightweight transliterator fallback and emit only a generic log message, never the user text.
- Keep emergency detection on the unmodified raw text and do not change chat endpoint contracts, RAG behavior, database schemas, or safety response rules.
- Keep Lite Mode free of model weights, network calls, and heavy ML dependencies.

## Constraints and limitations

- Avro phonetic conversion is deterministic, not context-aware transliteration or translation; Romanized Bengali remains ambiguous and output is not guaranteed to be linguistically perfect.
- SafeHer must not log the original query or transliterated user text.
- Do not add or run tests/builds unless the user requests verification, per project instructions.
- The `avro.py` distribution uses the top-level `avro` import name; current direct requirements do not declare Apache Avro. Keep that namespace collision risk documented if another dependency later adds `avro`.

## Files in scope

- `backend/requirements.txt`
- `backend/language/transliterator.py`
- `README.md`
- `docs/superpowers/plans/2026-11-04-safeher-feature-repair.md`

## Review focus

- Empty, whitespace-only, and Bengali-script inputs remain unchanged by the Roman parser.
- URLs, email addresses, phone/numeric strings, acronyms, and current English tokens are not corrupted.
- Existing emergency detection still receives the original input.
- No public API response fields or RAG/direct-chat call paths change.
- User text is not sent to an external transliteration service and the dependency's raw-input cache is cleared after parsing.
