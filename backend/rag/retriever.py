"""
SafeHer — RAG Retriever
=========================
Semantic search over the ChromaDB knowledge base.

Pipeline:
  1. Preprocess query (detect → transliterate if Banglish → normalize)
  2. Embed normalized query with Bengali SBERT
  3. Query ChromaDB for cosine-nearest documents
  4. Filter: exclude any result with distance > threshold
  5. Return document texts (for injection into LLM prompt)

Safety design:
  - Empty results → triggers "call 999" fallback in the chat service
  - Any exception → returns empty list (never crashes)
  - Logged warnings on failures for debugging
"""

import logging
from typing import List, Optional, Dict

from rag.knowledge_base import get_collection
from rag.embeddings import BengaliEmbedder
from language.preprocessor import preprocess

logger = logging.getLogger("safeher.retriever")

# Distance threshold for cosine similarity
# Lower = more similar. 0.5 is a reasonable cutoff for Bengali SBERT.
# Documents with distance > this are too dissimilar to be useful.
DEFAULT_DISTANCE_THRESHOLD = 0.65
DEFAULT_N_RESULTS = 4


def retrieve(
    query: str,
    n_results: int = DEFAULT_N_RESULTS,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD,
    category_filter: Optional[str] = None,
    lang_filter: Optional[str] = None,
) -> List[Dict]:
    """
    Retrieve top-k relevant passages for a user query.

    Args:
        query: Raw user input (any language/script)
        n_results: Number of results to fetch from ChromaDB
        distance_threshold: Max cosine distance (0-2 for cosine; lower = more similar)
        category_filter: Optional category to restrict search (e.g., "emergency")
        lang_filter: Optional language filter ("bn" or "en")

    Returns:
        List of dicts with keys: text, category, lang, distance
        Empty list if no relevant results found

    Edge cases:
        - Empty query → empty list
        - All results too dissimilar → empty list (caller handles)
        - ChromaDB error → empty list with logged warning
        - Embedding model not loaded → empty list with logged error
    """
    if not query or not query.strip():
        return []

    try:
        # Step 1: Preprocess the query
        preprocessed = preprocess(query)
        logger.debug(
            f"Query preprocessed: lang={preprocessed.lang}, "
            f"transliterated={preprocessed.was_transliterated}, "
            f"emergency={preprocessed.is_emergency}"
        )

        # Step 2: Embed the normalized query
        embedder = BengaliEmbedder.get()
        query_embedding = embedder.encode_single(preprocessed.normalized)

        # Step 3: Build metadata filter
        where_filter = _build_where_filter(category_filter, lang_filter)

        # Step 4: Query ChromaDB
        collection = get_collection()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "distances", "metadatas"],
            where=where_filter,
        )

        # Step 5: Filter by distance threshold
        docs = results["documents"][0]
        distances = results["distances"][0]
        metadatas = results["metadatas"][0]

        filtered = []
        for doc, dist, meta in zip(docs, distances, metadatas):
            if dist < distance_threshold:
                filtered.append({
                    "text": doc,
                    "category": meta.get("category", "unknown"),
                    "lang": meta.get("lang", "unknown"),
                    "distance": round(dist, 4),
                })

        logger.info(
            f"Retrieved {len(filtered)}/{len(docs)} passages "
            f"(threshold={distance_threshold}) for query: {query[:50]}..."
        )

        return filtered

    except Exception as e:
        # NEVER crash on retrieval failure — safety-critical endpoint
        logger.error(f"Retriever error: {e}", exc_info=True)
        return []


def retrieve_texts(
    query: str,
    n_results: int = DEFAULT_N_RESULTS,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> List[str]:
    """
    Convenience method: retrieve and return only the text strings.
    Used by chat_service for prompt injection.
    """
    results = retrieve(query, n_results, distance_threshold)
    return [r["text"] for r in results]


def retrieve_emergency(query: str) -> List[str]:
    """
    Emergency-specific retrieval with relaxed threshold.
    Used when danger signals are detected in the query.
    Searches across both emergency and action categories.
    """
    results = []

    # Search emergency numbers
    emergency_results = retrieve(
        query, n_results=3, distance_threshold=0.8,
        category_filter="emergency"
    )
    results.extend([r["text"] for r in emergency_results])

    # Search action guidance
    action_results = retrieve(
        query, n_results=2, distance_threshold=0.8,
        category_filter="action"
    )
    results.extend([r["text"] for r in action_results])

    # Deduplicate
    seen = set()
    unique = []
    for text in results:
        if text not in seen:
            seen.add(text)
            unique.append(text)

    return unique[:5]  # Max 5 passages for emergency


def _build_where_filter(
    category: Optional[str], lang: Optional[str]
) -> Optional[dict]:
    """Build ChromaDB where filter from optional category and lang."""
    conditions = []
    if category:
        conditions.append({"category": category})
    if lang:
        conditions.append({"lang": lang})

    if len(conditions) == 0:
        return None
    elif len(conditions) == 1:
        return conditions[0]
    else:
        return {"$and": conditions}
