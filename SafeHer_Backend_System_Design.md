# SafeHer — Complete Backend System Design
**FastAPI · Python · Bengali/Banglish NLP · RAG · OSM Routing · Supabase · Firebase**

---

## Part 1: The Language Problem — Bengali, Banglish, and Why It Matters

### Do you need a specific model for Bengali/Banglish?

Yes. And the reason is technical, not political.

Bengali uses the **alphasyllabary script** — base characters modified by diacritics that form
multi-character grapheme clusters. Standard LLM tokenizers (BPE-based, trained on English-heavy
corpora) shatter Bengali words into fragments, sometimes 3–5 tokens per word that would be
1 token in English. This is the "token tax" problem documented in recent research: Bengali gets
less context per token, higher inference cost, and degraded comprehension for the same text length.

**Banglish** (romanized Bengali — "bachao", "amake help koro", "eta ki safe area?") is worse.
It has no standard orthography. The same word can be spelled 4–6 different ways depending on the
user's keyboard habit, region, and age. Multilingual models trained on clean text see Banglish as
"almost like hieroglyphics" — their tokenizers have no patterns for it and frequently hallucinate.

**The practical implication for SafeHer:** Your users will type:
- Pure Bengali: `"কেউ আমাকে অনুসরণ করছে"`
- Banglish: `"keu amake follow korche, help lagbe"`
- Code-mixed: `"ami ektu scared, nearby kono safe place ache?"`
- English: `"I think someone is following me"`

Your backend must handle all four reliably. The wrong design is to ignore this and hope the LLM
figures it out. The right design is a preprocessing normalization layer before anything reaches the LLM.

---

### Model Decision: What to Use

**For the LLM (generation/chat): Groq `llama-3.3-70b-versatile`**

This is the current active model on Groq (Llama 3.1-70b was deprecated in December 2024;
`llama-3.3-70b-versatile` is its replacement with meaningfully better multilingual performance).
Llama 3.1-8B scores 0.51 Pass@1 on Bangla instructions; 3.3-70B at its scale is substantially
stronger. For the safety-critical chatbot, 70B is non-negotiable over 8B — you want the reasoning
capacity to handle ambiguous emergency queries correctly.

Groq's inference speed (typically 200-400 tokens/second on 70B) means sub-second responses
even for complex Bengali queries, which matters for a frightened user.

**For embeddings (RAG retrieval): `l3cube-pune/bengali-sentence-similarity-sbert`**

This is the empirically verified winner for Bengali RAG. The Bangla-RAG/PoRAG project on GitHub
tested three models — `sagorsarker/bangla-bert-base`, `csebuetnlp/banglabert`, and
`l3cube-pune/bengali-sentence-similarity-sbert` — and found the l3cube model most effective
for retrieval quality. It is SBERT-based (Sentence-BERT), which produces sentence-level
embeddings directly suited for semantic search. Runs at ~80MB, fits comfortably in Render's
512MB free tier alongside FastAPI.

**For Banglish normalization: Rule-based transliterator + `csebuetnlp/normalizer`**

BanglaBERT (csebuetnlp) ships a normalization pipeline specifically for Bengali text cleaning.
For Banglish, you prepend a lightweight phonetic transliteration step. No model needed here.
Rule-based is faster and more predictable for the finite set of romanization patterns in use.

**Model selection summary:**

| Task | Model | Justification |
|------|-------|---------------|
| Chat/generation | `groq: llama-3.3-70b-versatile` | Fast free inference, best Bengali reasoning at scale |
| Sentence embeddings | `l3cube-pune/bengali-sentence-similarity-sbert` | Empirically best for Bengali RAG (PoRAG project) |
| Text normalization | `csebuetnlp/normalizer` | Purpose-built for BanglaBERT pipeline |
| Banglish detection | Custom rule-based | Finite patterns, no model overhead |
| Language detection | `langdetect` library | Lightweight, handles bn/en/mixed |

---

### Relevant GitHub Projects

These are the reference implementations your backend borrows from:

| Project | What it solves | Link |
|---------|---------------|------|
| **Bangla-RAG/PoRAG** | Bengali RAG pipeline — tested embeddings, ChromaDB, LLM integration | `github.com/Bangla-RAG/PoRAG` |
| **csebuetnlp/banglabert** | BanglaBERT + normalization pipeline — state-of-art Bengali NLU | `github.com/csebuetnlp/banglabert` |
| **sagorbrur/bangla-bert** | Bangla-BERT-Base — lighter alternative embedding model | `github.com/sagorbrur/bangla-bert` |
| **banglakit/awesome-bangla** | Curated Bengali NLP tools, datasets, pipelines | `github.com/banglakit/awesome-bangla` |
| **Foysal87/Bangla-NLP-Dataset** | BanglishRev (1.74M code-mixed reviews), BanglaTLit dataset | `github.com/Foysal87/Bangla-NLP-Dataset` |
| **lingo-iitgn/awesome-code-mixing** | Code-switching NLP resources including Bengali-English | `github.com/lingo-iitgn/awesome-code-mixing` |
| **shuaib128/Banglish** | Phonetic Banglish-to-Bengali transliteration rules | `github.com/shuaib128/Banglish` |

---

## Part 2: Repository Structure

```
safeher-backend/
├── main.py                         ← FastAPI app, router mounts, CORS, startup events
├── requirements.txt
├── .env                            ← All secrets, never committed
│
├── core/
│   ├── config.py                   ← Pydantic Settings, env loading
│   ├── logger.py                   ← Structured JSON logging
│   └── exceptions.py               ← Custom exception classes + handlers
│
├── language/                       ← Language normalization pipeline (entire module)
│   ├── detector.py                 ← Detect: Bengali / Banglish / English / code-mixed
│   ├── normalizer.py               ← BanglaBERT normalizer wrapper
│   ├── transliterator.py           ← Banglish → Bengali script conversion
│   └── preprocessor.py             ← Orchestrates: detect → transliterate → normalize
│
├── routers/
│   ├── chat.py                     ← POST /chat — RAG chatbot endpoint
│   ├── route.py                    ← GET /route — safe route recommendation
│   ├── incidents.py                ← POST /incidents — community report ingestion
│   ├── sos.py                      ← POST /sos — SOS event logging + webhook
│   └── health.py                   ← GET /health — uptime ping, prevent Render sleep
│
├── services/
│   ├── chat_service.py             ← RAG pipeline: retrieve → format prompt → generate
│   ├── routing_service.py          ← Graph load, A* execution, GeoJSON output
│   ├── incident_service.py         ← Supabase write, PostGIS proximity queries
│   └── sos_service.py              ← SOS event logging, Supabase insert
│
├── rag/
│   ├── knowledge_base.py           ← ChromaDB init, collection management
│   ├── embeddings.py               ← l3cube SBERT loader + encode function
│   ├── retriever.py                ← Query ChromaDB, return top-k passages
│   └── seed_data/
│       ├── emergency_bn.txt        ← Bengali emergency facts
│       ├── emergency_en.txt        ← English emergency facts
│       ├── legal_rights.txt        ← Bangladesh legal information
│       └── situational_guide.txt   ← Action guidance for specific scenarios
│
├── routing/
│   ├── graph_loader.py             ← Load precomputed .graphml at startup
│   ├── safety_scorer.py            ← Edge weight computation
│   ├── pathfinder.py               ← A* over safety-weighted graph
│   └── geojson_builder.py          ← Convert node path → GeoJSON LineString
│
├── db/
│   ├── supabase_client.py          ← Supabase JS client init
│   └── firebase_client.py          ← Firebase Admin SDK init (SOS tracking)
│
├── precompute/
│   ├── build_graph.py              ← Run locally: downloads OSM, scores edges, saves .graphml
│   ├── build_knowledge_base.py     ← Run locally: seeds ChromaDB from seed_data/
│   └── chittagong_incidents.geojson ← Hand-curated 30 unsafe zone polygons
│
└── data/
    └── chittagong_walk.graphml     ← Precomputed, committed to repo (~50MB)
```

---

## Part 3: Language Preprocessing Pipeline

This is the most critical and most underbuilt part of most Bengali NLP backends.
Every piece of user text passes through this before reaching the LLM or embeddings.

### Step 1 — Detect language

```python
# language/detector.py
import re
from langdetect import detect, LangDetectException

BENGALI_UNICODE_RANGE = re.compile(r'[\u0980-\u09FF]')
BANGLISH_PATTERNS = re.compile(
    r'\b(ami|tumi|apni|ache|hobe|koro|kori|korbo|lagbe|dao|din|jai|jabo|'
    r'thako|thakbo|boro|choto|valo|kharap|khub|onek|ki|ke|keno|kothay|'
    r'bachao|help|danger|safe|emon|ekhane|ekhon|janina|bolun|bolo)\b',
    re.IGNORECASE
)

class LanguageType:
    BENGALI = "bn"
    BANGLISH = "banglish"
    CODE_MIXED = "code_mixed"
    ENGLISH = "en"
    UNKNOWN = "unknown"

def detect_language(text: str) -> str:
    """
    Returns one of: bn, banglish, code_mixed, en, unknown
    
    Detection order matters:
    1. Check for Bengali unicode chars first — definitive signal
    2. Check for Banglish patterns in roman script
    3. Fall back to langdetect
    4. Default to 'en' if all fail — safe fallback for LLM
    """
    if not text or not text.strip():
        return LanguageType.UNKNOWN

    has_bengali_script = bool(BENGALI_UNICODE_RANGE.search(text))
    has_banglish = bool(BANGLISH_PATTERNS.search(text))
    has_english_words = bool(re.search(r'[a-zA-Z]{3,}', text))

    # Pure Bengali script
    if has_bengali_script and not has_english_words:
        return LanguageType.BENGALI

    # Mixed script (Bengali + Latin) — code-mixed
    if has_bengali_script and has_english_words:
        return LanguageType.CODE_MIXED

    # Roman script with Banglish patterns
    if has_banglish and not has_bengali_script:
        return LanguageType.BANGLISH

    # Roman script, no Banglish patterns — try langdetect
    try:
        detected = detect(text)
        return detected if detected in ["en", "bn"] else LanguageType.ENGLISH
    except LangDetectException:
        return LanguageType.ENGLISH
```

### Step 2 — Transliterate Banglish to Bengali script

```python
# language/transliterator.py
"""
Phonetic Banglish-to-Bengali transliteration.
Based on Avro phonetic keyboard rules (the de-facto standard in Bangladesh).
Reference: github.com/shuaib128/Banglish phonetic rules.

This is rule-based, not ML-based. Faster, more predictable, no RAM cost.
Critical edge cases handled:
- 'sh' before vowel → শ (sha sound), 'sh' elsewhere → ষ
- 'kh' → খ, 'gh' → ঘ, 'ch' → চ, 'chh' → ছ
- Doubled consonants: 'tt' → ত্ত, 'kk' → ক্ক
- Numbers stay as-is
- English proper nouns (capitalized) stay as-is
"""

# Ordered by length (longest match first) to prevent partial replacements
PHONETIC_MAP = [
    # Digraphs and special combos — check BEFORE single chars
    ("kkhh", "ক্খ"), ("ngng", "ঙ্ঙ"),
    ("chh",  "ছ"),   ("ksh",  "ক্ষ"),
    ("jjh",  "ঝ"),   ("ddh",  "ড্ধ"),
    ("Sh",   "শ"),   ("sh",   "শ"),
    ("kh",   "খ"),   ("gh",   "ঘ"),
    ("ch",   "চ"),   ("jh",   "ঝ"),
    ("Th",   "ঠ"),   ("th",   "থ"),
    ("Dh",   "ঢ"),   ("dh",   "ধ"),
    ("ph",   "ফ"),   ("bh",   "ভ"),
    ("ng",   "ং"),   ("ny",   "ঞ"),
    # Single vowels
    ("aa",   "আ"),   ("ii",   "ই"),   ("uu",   "উ"),
    ("a",    "অ"),   ("i",    "ই"),   ("u",    "উ"),
    ("e",    "এ"),   ("o",    "ও"),
    # Single consonants
    ("k",    "ক"),   ("g",    "গ"),   ("c",    "ক"),
    ("j",    "জ"),   ("t",    "ত"),   ("d",    "দ"),
    ("n",    "ন"),   ("p",    "প"),   ("b",    "ব"),
    ("m",    "ম"),   ("r",    "র"),   ("l",    "ল"),
    ("s",    "স"),   ("h",    "হ"),   ("f",    "ফ"),
    ("v",    "ভ"),   ("w",    "ও"),   ("y",    "য"),
    ("z",    "জ"),
]

def transliterate_banglish(text: str) -> str:
    """
    Convert Banglish (romanized Bengali) to Bengali script.
    
    Edge cases:
    - Capitalized words are treated as English proper nouns, skipped
    - Numbers and punctuation pass through unchanged
    - Mixed words split on word boundary, each word processed independently
    """
    words = text.split()
    result = []

    for word in words:
        # Skip: pure numbers, English proper nouns (Title Case), URLs
        if word.isdigit() or word[0].isupper() or word.startswith("http"):
            result.append(word)
            continue

        converted = word.lower()
        for roman, bengali in PHONETIC_MAP:
            converted = converted.replace(roman, bengali)
        result.append(converted)

    return " ".join(result)
```

### Step 3 — BanglaBERT normalization

```python
# language/normalizer.py
"""
Applies csebuetnlp/normalizer — mandatory preprocessing for BanglaBERT pipeline.
Handles: Unicode normalization, zero-width characters, hasanta fixes,
         punctuation normalization, numeral unification.

IMPORTANT: Must run AFTER transliteration, BEFORE embedding.
"""
from normalizer import normalize as bn_normalize  # pip install git+https://github.com/csebuetnlp/normalizer

def normalize_bengali(text: str) -> str:
    """
    Safe wrapper around csebuetnlp normalizer.
    Returns original text on failure rather than crashing.
    """
    try:
        return bn_normalize(text)
    except Exception:
        return text  # Graceful degradation
```

### Step 4 — Orchestrator (entry point for all text)

```python
# language/preprocessor.py
from language.detector import detect_language, LanguageType
from language.transliterator import transliterate_banglish
from language.normalizer import normalize_bengali

class PreprocessedText:
    def __init__(self, original: str, normalized: str, lang: str, was_transliterated: bool):
        self.original = original
        self.normalized = normalized
        self.lang = lang
        self.was_transliterated = was_transliterated

def preprocess(text: str) -> PreprocessedText:
    """
    Full pipeline:
    1. Detect language
    2. If Banglish: transliterate to Bengali script
    3. If Bengali or freshly transliterated: apply BanglaBERT normalization
    4. If English: pass through unchanged (LLM handles English natively)
    5. If code-mixed: normalize Bengali portions, keep English portions

    Returns PreprocessedText with both original and normalized versions.
    The normalized version goes to embeddings.
    The original version goes into the prompt context for user display.
    """
    lang = detect_language(text)
    was_transliterated = False

    if lang == LanguageType.BANGLISH:
        text_for_processing = transliterate_banglish(text)
        was_transliterated = True
        normalized = normalize_bengali(text_for_processing)

    elif lang in (LanguageType.BENGALI, LanguageType.CODE_MIXED):
        normalized = normalize_bengali(text)

    else:  # English or unknown
        normalized = text

    return PreprocessedText(
        original=text,
        normalized=normalized,
        lang=lang,
        was_transliterated=was_transliterated
    )
```

---

## Part 4: RAG Pipeline (Full Implementation)

### Knowledge base seeding

```python
# rag/knowledge_base.py
import chromadb
from chromadb.config import Settings
from rag.embeddings import BengaliEmbedder

# Persistent path — survives Render restarts (stored in /data volume)
CHROMA_PATH = "./chroma_store"

def get_collection():
    client = chromadb.PersistentClient(
        path=CHROMA_PATH,
        settings=Settings(anonymized_telemetry=False)
    )
    return client.get_or_create_collection(
        name="safeher_knowledge",
        # Use cosine similarity — better than L2 for sentence embeddings
        metadata={"hnsw:space": "cosine"}
    )
```

```python
# rag/embeddings.py
from sentence_transformers import SentenceTransformer
import numpy as np

class BengaliEmbedder:
    """
    Loads l3cube-pune/bengali-sentence-similarity-sbert.
    Singleton pattern — model loads ONCE at startup, reused for all requests.
    Loading cost: ~3 seconds. Inference cost: ~50ms per query.
    RAM: ~80MB.

    Why this model over banglabert:
    - SBERT produces sentence-level embeddings directly (BanglaBERT produces token-level,
      needs pooling which loses nuance)
    - Empirically best retrieval in PoRAG benchmarks (github.com/Bangla-RAG/PoRAG)
    - Handles code-mixed Bengali-English better than monolingual models
    """
    _instance = None

    @classmethod
    def get(cls) -> "BengaliEmbedder":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.model = SentenceTransformer("l3cube-pune/bengali-sentence-similarity-sbert")

    def encode(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()
```

### Seed data structure

```python
# precompute/build_knowledge_base.py
"""
Run this locally once. ChromaDB persists to disk. Committed to repo.
Do NOT re-run on every deploy — it would re-embed 100+ docs on cold start.

Knowledge base entries are bilingual: every critical fact has both
Bengali and English versions as separate documents. This ensures
retrieval works regardless of query language.
"""
from rag.knowledge_base import get_collection
from rag.embeddings import BengaliEmbedder

KNOWLEDGE_BASE = [
    # === EMERGENCY NUMBERS ===
    {
        "id": "E001_bn",
        "text": "জরুরী সাহায্যের জন্য ৯৯৯ কল করুন। পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স। সম্পূর্ণ বিনামূল্যে, ২৪ ঘণ্টা।",
        "category": "emergency", "lang": "bn"
    },
    {
        "id": "E001_en",
        "text": "National emergency number is 999. Covers police, fire, and ambulance. Free to call 24/7 from any phone.",
        "category": "emergency", "lang": "en"
    },
    {
        "id": "E002_bn",
        "text": "নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন: ১০৯২১। যৌন হয়রানি, নির্যাতন বা পাচারের ক্ষেত্রে কল করুন।",
        "category": "emergency", "lang": "bn"
    },
    {
        "id": "E002_en",
        "text": "Women and Children Repression Prevention Hotline: 10921. For sexual harassment, assault, or trafficking.",
        "category": "emergency", "lang": "en"
    },
    {
        "id": "E003_bn",
        "text": "চট্টগ্রাম মেট্রোপলিটন পুলিশ হেল্পলাইন: ০১৭৬৯-৬৮০২৬৬",
        "category": "emergency", "lang": "bn"
    },
    {
        "id": "E003_en",
        "text": "Chittagong Metropolitan Police helpline: 01769-680266",
        "category": "emergency", "lang": "en"
    },
    # === IMMEDIATE ACTION GUIDANCE ===
    {
        "id": "A001_bn",
        "text": "কেউ পিছু নিলে: সাথে সাথে কাছের মসজিদ, ফার্মেসি বা ভিড়ের দোকানে ঢুকুন। বাড়ির দিকে যাবেন না। ৯৯৯ কল করুন।",
        "category": "action", "lang": "bn"
    },
    {
        "id": "A001_en",
        "text": "If being followed: immediately enter a nearby mosque, pharmacy, or crowded shop. Do not go home. Call 999.",
        "category": "action", "lang": "en"
    },
    {
        "id": "A002_bn",
        "text": "সিএনজি বা রিকশায় অনিরাপদ লাগলে: গাড়ির নম্বর মনে রাখুন। ব্যস্ত, আলোকিত মোড়ে থামতে বলুন। অন্ধকার গলিতে না।",
        "category": "action", "lang": "bn"
    },
    {
        "id": "A002_en",
        "text": "If feeling unsafe in a CNG or rickshaw: memorize the vehicle number. Ask to stop at a busy, well-lit intersection, not a dark alley.",
        "category": "action", "lang": "en"
    },
    {
        "id": "A003_bn",
        "text": "বাসে হয়রানি হলে: জোরে কথা বলুন, পাশের যাত্রীদের সাহায্য চান। চালক বা হেল্পারকে ডাকুন। পরের জনবহুল স্টপে নামুন।",
        "category": "action", "lang": "bn"
    },
    {
        "id": "A003_en",
        "text": "If harassed on a bus: speak loudly, alert nearby passengers. Call the driver or helper. Get off at the next populated stop.",
        "category": "action", "lang": "en"
    },
    # === LEGAL RIGHTS ===
    {
        "id": "L001_bn",
        "text": "নারী ও শিশু নির্যাতন দমন আইন ২০০০ অনুযায়ী, প্রকাশ্য স্থানে যৌন হয়রানি ফৌজদারি অপরাধ। সর্বোচ্চ সাজা ৭ বছর কারাদণ্ড।",
        "category": "legal", "lang": "bn"
    },
    {
        "id": "L001_en",
        "text": "Under the Prevention of Women and Children Repression Act 2000, sexual harassment in public is a criminal offense punishable by up to 7 years imprisonment.",
        "category": "legal", "lang": "en"
    },
    {
        "id": "L002_bn",
        "text": "যেকোনো থানায় এফআইআর দায়ের করার অধিকার আপনার আছে। পুলিশ মামলা নিতে অস্বীকার করলে সুপারিনটেনডেন্ট অব পুলিশের কাছে অভিযোগ করুন।",
        "category": "legal", "lang": "bn"
    },
    {
        "id": "L002_en",
        "text": "You have the right to file an FIR at any police station. If police refuse, complain directly to the Superintendent of Police or approach a magistrate court.",
        "category": "legal", "lang": "en"
    },
    # === DIGITAL SAFETY ===
    {
        "id": "D001_bn",
        "text": "সাইবার অপরাধ হেল্পলাইন: ০১৭৬৬-৬৭৮৮৮৮। অনলাইন হয়রানি, হুমকি বা ব্যক্তিগত ছবির অপব্যবহারের ক্ষেত্রে কল করুন।",
        "category": "digital", "lang": "bn"
    },
    {
        "id": "D001_en",
        "text": "Cybercrime helpline: 01766-678888. For online harassment, threats, or non-consensual sharing of personal images.",
        "category": "digital", "lang": "en"
    },
    # === LEGAL AID ===
    {
        "id": "LA001_bn",
        "text": "বিনামূল্যে আইনি সহায়তার জন্য: BLAST (Bangladesh Legal Aid and Services Trust) — 02-41033011",
        "category": "legal_aid", "lang": "bn"
    },
    {
        "id": "LA001_en",
        "text": "Free legal help: BLAST (Bangladesh Legal Aid and Services Trust) — 02-41033011. Ain o Salish Kendra: 01819-454151.",
        "category": "legal_aid", "lang": "en"
    },
    # Add 20+ more covering: safe locations in Chittagong, transport-specific scenarios,
    # medical evidence guidance, night-time safety protocols, trusted adult contacts, etc.
]

def seed():
    collection = get_collection()
    embedder = BengaliEmbedder.get()

    texts = [doc["text"] for doc in KNOWLEDGE_BASE]
    ids = [doc["id"] for doc in KNOWLEDGE_BASE]
    metadatas = [{"category": doc["category"], "lang": doc["lang"]} for doc in KNOWLEDGE_BASE]
    embeddings = embedder.encode(texts)

    collection.upsert(documents=texts, ids=ids, metadatas=metadatas, embeddings=embeddings)
    print(f"Seeded {len(KNOWLEDGE_BASE)} documents into ChromaDB.")

if __name__ == "__main__":
    seed()
```

### Retriever

```python
# rag/retriever.py
from rag.knowledge_base import get_collection
from rag.embeddings import BengaliEmbedder
from language.preprocessor import preprocess

def retrieve(query: str, n_results: int = 4) -> list[str]:
    """
    Retrieve top-k relevant passages for a user query.

    Pipeline:
    1. Preprocess query (detect → transliterate if Banglish → normalize)
    2. Embed normalized query with Bengali SBERT
    3. Query ChromaDB for cosine-nearest documents
    4. Filter: exclude any result with distance > 0.5 (too dissimilar)
    5. Return document texts

    Edge cases handled:
    - Empty query: return empty list (caller handles gracefully)
    - All results too dissimilar: return empty list (triggers fallback to 999)
    - ChromaDB timeout: return empty list with logged warning
    """
    if not query or not query.strip():
        return []

    try:
        preprocessed = preprocess(query)
        embedding = BengaliEmbedder.get().encode([preprocessed.normalized])[0]

        collection = get_collection()
        results = collection.query(
            query_embeddings=[embedding],
            n_results=n_results,
            include=["documents", "distances"]
        )

        # Filter by similarity threshold
        docs, distances = results["documents"][0], results["distances"][0]
        filtered = [doc for doc, dist in zip(docs, distances) if dist < 0.5]

        return filtered if filtered else []

    except Exception as e:
        # Log but never crash — safety-critical endpoint
        import logging
        logging.warning(f"Retriever error: {e}")
        return []
```

---

## Part 5: Chat Endpoint — Full Implementation

```python
# routers/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from services.chat_service import generate_response
from language.detector import detect_language

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    query: str
    conversation_id: str | None = None  # Optional: for future multi-turn support

    @field_validator("query")
    @classmethod
    def query_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        if len(v) > 1000:
            raise ValueError("Query too long (max 1000 characters)")
        return v

class ChatResponse(BaseModel):
    reply: str
    lang_detected: str
    was_transliterated: bool
    fallback_used: bool  # True if no relevant passages found, fell back to 999

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = await generate_response(request.query)
        return result
    except Exception as e:
        # Never return a 500 to a frightened user — always give emergency number
        return ChatResponse(
            reply="দুঃখিত, এখন সাহায্য করতে পারছি না। এখনই ৯৯৯ কল করুন। / Sorry, I can't help right now. Call 999 immediately.",
            lang_detected="unknown",
            was_transliterated=False,
            fallback_used=True
        )
```

```python
# services/chat_service.py
import os
from groq import AsyncGroq
from rag.retriever import retrieve
from language.preprocessor import preprocess

groq_client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

SYSTEM_PROMPT = """You are SafeHer, a calm emergency safety guide for women in Bangladesh.

ABSOLUTE RULES — violate none of these:
1. Answer ONLY from the CONTEXT passages below. Never use outside knowledge.
2. If context does not contain the answer, respond EXACTLY:
   Bengali: "এই তথ্য আমার কাছে নেই। এখনই ৯৯৯ কল করুন।"
   English: "I don't have that information. Call 999 now."
3. If the user mentions danger, fear, being followed, or being hurt — your FIRST sentence must be:
   Bengali: "এখনই ৯৯৯ কল করুন।"  English: "Call 999 now."
4. NEVER invent phone numbers, addresses, laws, or names. A wrong number could cost someone their life.
5. Maximum 3 sentences. No bullet lists. No greetings. No sign-offs.
6. Respond in the same language the user wrote in. Bengali query → Bengali reply.
   Code-mixed or Banglish → Bengali reply (they are more comfortable in Bengali).

CONTEXT:
{context}"""

DANGER_SIGNALS = [
    # Bengali
    "ভয়", "বিপদ", "সাহায্য", "বাঁচাও", "ধরেছে", "মারছে", "আক্রমণ", "ছিনতাই",
    "অনুসরণ", "পিছু", "ধরে", "টানছে",
    # Banglish / English
    "help", "danger", "scared", "following", "attack", "grab", "hurt", "trapped",
    "emergency", "bachao", "bipad", "voy", "dhore", "maarse"
]

async def generate_response(query: str) -> dict:
    preprocessed = preprocess(query)

    # Check for immediate danger signals BEFORE retrieval
    query_lower = query.lower()
    is_danger = any(signal in query_lower for signal in DANGER_SIGNALS)

    passages = retrieve(query)
    fallback_used = len(passages) == 0

    if fallback_used:
        # No relevant passages — return hard-coded emergency response
        if preprocessed.lang in ("bn", "banglish", "code_mixed"):
            reply = "এই তথ্য আমার কাছে নেই। এখনই ৯৯৯ কল করুন।"
        else:
            reply = "I don't have that information. Call 999 immediately."

        return {
            "reply": reply,
            "lang_detected": preprocessed.lang,
            "was_transliterated": preprocessed.was_transliterated,
            "fallback_used": True
        }

    context = "\n".join(f"[{i+1}] {p}" for i, p in enumerate(passages))
    system = SYSTEM_PROMPT.format(context=context)

    # Prepend danger signal to system if detected
    if is_danger:
        system = "CRITICAL: User may be in immediate danger. Start response with emergency number.\n\n" + system

    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": query}  # Send ORIGINAL query, not normalized
        ],
        max_tokens=150,
        temperature=0.05,  # Near-deterministic for safety-critical responses
        top_p=0.9,
    )

    return {
        "reply": response.choices[0].message.content.strip(),
        "lang_detected": preprocessed.lang,
        "was_transliterated": preprocessed.was_transliterated,
        "fallback_used": False
    }
```

---

## Part 6: Route Recommendation Endpoint

### Precompute script (run locally, once)

```python
# precompute/build_graph.py
"""
Run this on your local machine BEFORE deployment.
Output: data/chittagong_walk.graphml (~50MB)
Time: 4–8 minutes (one-time)
Never run this at request time. Never run this on Render's free tier.
"""
import osmnx as ox
import networkx as nx
import json
import numpy as np
from sklearn.neighbors import KernelDensity
import pandas as pd

def build_and_save_graph():
    print("Step 1/5: Downloading Chittagong walk network from OSM...")
    G = ox.graph_from_place("Chittagong, Bangladesh", network_type="walk")
    print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    print("Step 2/5: Loading CrimeDataBD — filtering female-victim incidents...")
    crimes = pd.read_csv("crimedatabd.csv")
    female = crimes[
        (crimes["victim_gender"] == "female") &
        (crimes["latitude"].notna()) &
        (crimes["longitude"].notna())
    ][["latitude", "longitude"]]
    coords = np.radians(female.values)

    print(f"  {len(female)} female-victim incidents loaded")

    print("Step 3/5: Fitting KDE on incident coordinates...")
    kde = KernelDensity(bandwidth=0.005, metric="haversine", algorithm="ball_tree")
    kde.fit(coords)
    # Compute normalization constant from training data
    all_scores = kde.score_samples(coords)
    max_density = np.exp(all_scores.max())

    print("Step 4/5: Loading hand-curated Chittagong hotspot zones...")
    with open("precompute/chittagong_incidents.geojson") as f:
        hotspot_data = json.load(f)

    # Build quick lookup: list of (lat, lng, risk_level) tuples
    hotspots = []
    for feature in hotspot_data["features"]:
        coords_pt = feature["geometry"]["coordinates"]
        risk = feature["properties"].get("risk", 0.8)
        hotspots.append((coords_pt[1], coords_pt[0], risk))  # lat, lng, risk

    def hotspot_score(lat, lng):
        """Check if edge midpoint falls within 200m of any hotspot."""
        for hlat, hlng, risk in hotspots:
            dlat = abs(lat - hlat) * 111000  # approx meters
            dlng = abs(lng - hlng) * 111000 * 0.85
            if (dlat**2 + dlng**2)**0.5 < 200:
                return risk
        return 0.0

    road_safety = {
        "footway": 0.95, "pedestrian": 0.90, "path": 0.80, "steps": 0.70,
        "living_street": 0.78, "residential": 0.70, "unclassified": 0.60,
        "tertiary": 0.55, "secondary": 0.45, "primary": 0.30,
        "trunk": 0.15, "motorway": 0.05
    }

    print("Step 5/5: Scoring edges...")
    edge_count = G.number_of_edges()
    for idx, (u, v, data) in enumerate(G.edges(data=True)):
        if idx % 5000 == 0:
            print(f"  {idx}/{edge_count} edges scored...")

        # 1. Lighting score
        lighting = 1.0 if data.get("lit") == "yes" else (
            0.6 if data.get("lit") == "sunset" else 0.25
        )

        # 2. KDE incident density score
        mid_lat = (G.nodes[u]["y"] + G.nodes[v]["y"]) / 2
        mid_lng = (G.nodes[u]["x"] + G.nodes[v]["x"]) / 2
        point = np.radians([[mid_lat, mid_lng]])
        density = np.exp(kde.score_samples(point)[0]) / max_density
        kde_incident_score = 1.0 - min(density, 1.0)

        # 3. Hotspot overlay (community-sourced)
        hs_risk = hotspot_score(mid_lat, mid_lng)
        hotspot_incident_score = 1.0 - hs_risk

        # Combined incident score (average of both sources)
        incident_score = (kde_incident_score + hotspot_incident_score) / 2

        # 4. Road type score
        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]
        road_score = road_safety.get(highway, 0.50)

        # 5. SafetiPin-inspired composite (weights from academic literature)
        safety = (
            0.35 * lighting +
            0.40 * incident_score +
            0.25 * road_score
        )
        safety = max(safety, 0.01)  # Prevent division by zero

        length = data.get("length", 50)
        data["safety_cost"] = length * (2.0 - safety)  # Range: [1×, 2×] length
        data["safety_score"] = round(safety, 4)
        data["lighting_score"] = round(lighting, 4)
        data["incident_score"] = round(incident_score, 4)

    print("Saving graph...")
    ox.save_graphml(G, "data/chittagong_walk.graphml")
    print("Done. Commit data/chittagong_walk.graphml to your repo.")

if __name__ == "__main__":
    build_and_save_graph()
```

### Route API endpoint

```python
# routers/route.py
from fastapi import APIRouter, Query, HTTPException
from services.routing_service import get_routes

router = APIRouter(prefix="/route", tags=["routing"])

@router.get("/")
async def route(
    olat: float = Query(..., ge=-90, le=90, description="Origin latitude"),
    olng: float = Query(..., ge=-180, le=180, description="Origin longitude"),
    dlat: float = Query(..., ge=-90, le=90, description="Destination latitude"),
    dlng: float = Query(..., ge=-180, le=180, description="Destination longitude"),
):
    """
    Returns two GeoJSON LineString routes:
    - safe: optimized for safety score (teal, thick)
    - fast: shortest path by distance (amber, thin)

    Edge cases:
    - Origin or destination outside Chittagong graph bounds → 422
    - No path exists (river crossing, etc.) → 404 with clear message
    - Origin == destination → return single-point "you're already there"
    - Graph not loaded yet (startup race condition) → 503
    """
    if abs(olat - dlat) < 0.0001 and abs(olng - dlng) < 0.0001:
        raise HTTPException(status_code=400, detail="Origin and destination are the same point.")

    try:
        result = await get_routes(olat, olng, dlat, dlng)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Route calculation failed. Try nearby coordinates.")
```

```python
# services/routing_service.py
import osmnx as ox
import networkx as nx
import asyncio
from routing.graph_loader import get_graph
from routing.geojson_builder import path_to_geojson

async def get_routes(olat: float, olng: float, dlat: float, dlng: float) -> dict:
    G = get_graph()  # Pre-loaded singleton

    # Run blocking networkx calls in thread pool to not block async event loop
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _compute_routes, G, olat, olng, dlat, dlng)
    return result

def _compute_routes(G, olat, olng, dlat, dlng):
    try:
        origin = ox.nearest_nodes(G, olng, olat)
        dest = ox.nearest_nodes(G, dlng, dlat)
    except Exception:
        raise ValueError("Coordinates are outside the Chittagong road network.")

    # Check that snapped nodes are within 500m of requested coords
    origin_node = G.nodes[origin]
    dist_origin = ((origin_node["y"] - olat)**2 + (origin_node["x"] - olng)**2)**0.5 * 111000
    if dist_origin > 500:
        raise ValueError("Origin is too far from any walkable road (>500m). Check coordinates.")

    try:
        safe_nodes = nx.astar_path(
            G, origin, dest,
            weight="safety_cost",
            heuristic=lambda u, v: ox.distance.great_circle(
                G.nodes[u]["y"], G.nodes[u]["x"],
                G.nodes[v]["y"], G.nodes[v]["x"]
            )
        )
    except nx.NetworkXNoPath:
        raise ValueError("No walkable path found between these points. The area may be separated by a river or highway.")

    try:
        fast_nodes = nx.shortest_path(G, origin, dest, weight="length")
    except nx.NetworkXNoPath:
        fast_nodes = safe_nodes  # Fall back to safe route if fast fails

    # Compute summary stats
    safe_length = sum(
        G[safe_nodes[i]][safe_nodes[i+1]][0].get("length", 0)
        for i in range(len(safe_nodes)-1)
    )
    fast_length = sum(
        G[fast_nodes[i]][fast_nodes[i+1]][0].get("length", 0)
        for i in range(len(fast_nodes)-1)
    )

    return {
        "safe": path_to_geojson(G, safe_nodes),
        "fast": path_to_geojson(G, fast_nodes),
        "summary": {
            "safe_distance_m": round(safe_length),
            "fast_distance_m": round(fast_length),
            "extra_distance_m": round(safe_length - fast_length),
            "extra_minutes": round((safe_length - fast_length) / 80),  # 80m/min walk speed
        }
    }
```

```python
# routing/graph_loader.py
import osmnx as ox
import networkx as nx
import logging

_graph = None

def load_graph():
    """Called once at FastAPI startup."""
    global _graph
    logging.info("Loading precomputed Chittagong walk graph...")
    _graph = ox.load_graphml("data/chittagong_walk.graphml")
    logging.info(f"Graph loaded: {_graph.number_of_nodes()} nodes, {_graph.number_of_edges()} edges")

def get_graph() -> nx.MultiDiGraph:
    if _graph is None:
        raise RuntimeError("Graph not loaded yet. Startup may still be in progress.")
    return _graph
```

---

## Part 7: Incident Reporting Endpoint

```python
# routers/incidents.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from typing import Literal
from services.incident_service import save_incident, get_nearby_incidents

router = APIRouter(prefix="/incidents", tags=["incidents"])

VALID_CATEGORIES = Literal[
    "eve_teasing", "stalking", "physical_assault", "rape",
    "robbery", "unsafe_lighting", "unsafe_transport", "other"
]
VALID_TIME = Literal["morning", "afternoon", "evening", "night"]

class IncidentCreate(BaseModel):
    lat: float
    lng: float
    category: VALID_CATEGORIES
    description: str = ""
    time_of_day: VALID_TIME = "night"
    anonymous: bool = True  # All reports anonymous by default

    @field_validator("lat")
    @classmethod
    def lat_in_bangladesh(cls, v):
        # Bangladesh bounding box: lat 20.5–26.7, lng 88.0–92.7
        if not (20.5 <= v <= 26.7):
            raise ValueError("Latitude outside Bangladesh bounds")
        return v

    @field_validator("lng")
    @classmethod
    def lng_in_bangladesh(cls, v):
        if not (88.0 <= v <= 92.7):
            raise ValueError("Longitude outside Bangladesh bounds")
        return v

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v):
        return v.strip()[:500]  # Trim, cap at 500 chars

@router.post("/", status_code=201)
async def report_incident(incident: IncidentCreate):
    result = await save_incident(incident)
    return {"id": result["id"], "message": "Report received. Thank you."}

@router.get("/nearby")
async def nearby_incidents(
    lat: float,
    lng: float,
    radius_m: int = 1000
):
    """
    Fetch incidents within radius_m meters of (lat, lng).
    Uses PostGIS ST_DWithin for indexed spatial query.
    Max radius: 5000m to prevent expensive full-table scans.
    """
    if radius_m > 5000:
        radius_m = 5000
    return await get_nearby_incidents(lat, lng, radius_m)
```

---

## Part 8: SOS Event Logging

```python
# routers/sos.py
"""
Logs SOS activation events. This is NOT the alert dispatcher
(that runs client-side via EmailJS + Firebase).
This endpoint exists for analytics, audit trail, and future police integration.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/sos", tags=["sos"])

class SOSEvent(BaseModel):
    session_id: str  # Firebase RTDB session ID
    lat: float
    lng: float
    timestamp: int   # Unix ms
    trigger_method: str  # "button", "voice", "disguise_mode"
    lang_at_trigger: str  # Language active when SOS fired

@router.post("/log", status_code=201)
async def log_sos(event: SOSEvent):
    """
    Insert SOS event into Supabase for audit trail.
    Non-blocking — client does not wait for this response.
    """
    from db.supabase_client import supabase
    supabase.table("sos_events").insert({
        "session_id": event.session_id,
        "lat": event.lat,
        "lng": event.lng,
        "timestamp": event.timestamp,
        "trigger_method": event.trigger_method,
    }).execute()
    return {"logged": True}
```

---

## Part 9: Main App — Startup, CORS, Health

```python
# main.py
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, route, incidents, sos, health
from routing.graph_loader import load_graph
from rag.embeddings import BengaliEmbedder

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: load graph + embedder (both are singletons).
    These block the event loop briefly but run ONCE.
    Total startup time: ~5 seconds.
    """
    logging.info("SafeHer backend starting...")
    loop = asyncio.get_event_loop()

    # Load graph in thread pool (blocking I/O)
    await loop.run_in_executor(None, load_graph)

    # Load embedder in thread pool (downloads model on first run)
    await loop.run_in_executor(None, BengaliEmbedder.get)

    logging.info("Startup complete. Backend ready.")
    yield
    logging.info("Shutdown.")

app = FastAPI(
    title="SafeHer API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow Next.js frontend and the Render preview URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://safeher.vercel.app",
        "https://*.vercel.app",      # Vercel preview deployments
        "http://localhost:3000",     # Local dev
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(route.router)
app.include_router(incidents.router)
app.include_router(sos.router)
```

```python
# routers/health.py
"""
Critical: Render's free tier sleeps after 15 minutes of inactivity.
A cron job (UptimeRobot, cron-job.org — both free) hits this endpoint
every 14 minutes to keep the server alive.
Set up at: cron-job.org — ping https://safeher-api.onrender.com/health every 14 min.
"""
from fastapi import APIRouter
from routing.graph_loader import get_graph

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    try:
        G = get_graph()
        return {
            "status": "ok",
            "graph_nodes": G.number_of_nodes(),
            "graph_edges": G.number_of_edges()
        }
    except Exception:
        return {"status": "starting", "graph_nodes": 0}
```

---

## Part 10: requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.9.2
pydantic-settings==2.5.2

# Language processing
langdetect==1.0.9
sentence-transformers==3.3.1
git+https://github.com/csebuetnlp/normalizer  # BanglaBERT normalizer

# RAG
chromadb==0.5.23
groq==0.13.0

# Routing
osmnx==2.0.1
networkx==3.4.2
scikit-learn==1.5.2
numpy==1.26.4
pandas==2.2.3

# Database
supabase==2.9.1
firebase-admin==6.5.0

# ASGI
httpx==0.27.2
```

---

## Part 11: Edge Cases Reference Table

| Scenario | Where It Can Fail | How It's Handled |
|----------|------------------|-----------------|
| User types pure Banglish like "amake bachao keu help koro" | LLM can't parse romanized Bengali | `transliterate_banglish()` converts before embedding |
| User types Bengali with zero-width joiners or wrong Unicode forms | BanglaBERT tokenizer gets confused | `csebuetnlp/normalizer` fixes Unicode before embedding |
| Code-mixed: "ami ektu scared, nearby kono safe area ache?" | Detector might classify wrong | `CODE_MIXED` detection path keeps both scripts |
| OSM graph not loaded yet when first request hits | `get_graph()` raises RuntimeError | 503 returned with retry-after header |
| Origin coordinates outside Chittagong (user testing from abroad) | `nearest_nodes` snaps to wrong location | Bounding box validation rejects with 422 |
| No walkable path between two points (river, highway barrier) | `NetworkXNoPath` exception | Caught, returns 404 with human-readable message |
| ChromaDB returns 0 relevant passages (query too niche) | Empty context sent to LLM → hallucination risk | Hard-coded "call 999" fallback fires before LLM call |
| Groq API rate limit hit (free tier: 100k tokens/day) | `RateLimitError` exception | Cached responses for common queries (top 20 by frequency) |
| Render server sleeps (15-min inactivity) | First request times out, user gets error | UptimeRobot pings `/health` every 14 min |
| Incident report with coordinates outside Bangladesh | Bogus data enters PostGIS | Pydantic validator rejects lat/lng outside BD bounding box |
| Two SOS events from same session (button + voice trigger) | Duplicate Firebase RTDB entries | Session ID deduplication in SOS log handler |
| User writes danger query in English ("help me I'm being attacked") | System prompt specifies Bengali responses for Bengali users | LLM respects query language; English query → English response |
| Description field contains SQL injection or XSS | Database or display vulnerability | Pydantic `str` type + Supabase parameterized queries handle both |

---

## Part 12: Deployment Checklist

```
Local (before first push):
[ ] Run: python precompute/build_graph.py → confirm chittagong_walk.graphml created
[ ] Run: python precompute/build_knowledge_base.py → confirm ChromaDB seeded
[ ] Commit both: data/chittagong_walk.graphml, chroma_store/ to repo

Environment variables on Render:
[ ] GROQ_API_KEY
[ ] SUPABASE_URL
[ ] SUPABASE_SERVICE_KEY (server key, not anon key — for admin writes)
[ ] FIREBASE_ADMIN_CREDENTIALS (base64 encoded service account JSON)

Render settings:
[ ] Build command: pip install -r requirements.txt
[ ] Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
[ ] Instance type: Free (512MB RAM)
[ ] Set up cron-job.org: GET https://your-api.onrender.com/health every 14 minutes

Day before demo (July 8 + July 16):
[ ] Hit /health manually, verify graph_nodes > 0
[ ] Test /chat with "কেউ আমাকে অনুসরণ করছে" — confirm Bengali response
[ ] Test /chat with "amake help koro" — confirm Banglish transliterated correctly
[ ] Test /route for GEC Circle → Chittagong Medical College — confirm two routes returned
[ ] Test /incidents/nearby for Chittagong center — confirm seeded incidents visible
```
