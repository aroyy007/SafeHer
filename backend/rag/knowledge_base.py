"""
SafeHer — ChromaDB Knowledge Base Manager
============================================
Manages the persistent ChromaDB collection for RAG retrieval.

Design:
  - PersistentClient → survives server restarts
  - Cosine similarity metric (best for L2-normalized sentence embeddings
    from the Bengali SBERT model)
  - Auto-seeds on first startup if collection is empty
  - Collection name: "safeher_knowledge"

Path: configured via CHROMA_PATH in .env (default: ./chroma_store)

NOTE: chromadb is lazily imported inside the functions below so that
importing this module does NOT pull chromadb into RAM. This is the
single biggest lever for fitting on Render free tier (512 MB).
"""

import logging
from typing import Optional

logger = logging.getLogger("safeher.knowledge_base")

# Module-level singleton
_collection = None
_client = None


def get_client():
    """Get or create the ChromaDB client singleton (lazy import)."""
    global _client
    if _client is None:
        # Lazy import — keeps chromadb off the boot-time import graph
        # when RAG_DISABLED=true. Saves ~80 MB of RAM at boot.
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        from core.config import get_settings
        settings = get_settings()
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PATH,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=False,
            ),
        )
        logger.info(f"ChromaDB client initialized at: {settings.CHROMA_PATH}")
    return _client


def get_collection():
    """
    Get or create the knowledge base collection.

    Uses cosine similarity — optimal for L2-normalized sentence embeddings
    from the Bengali SBERT model. HNSW index provides fast approximate
    nearest-neighbor search.
    """
    global _collection
    if _collection is None:
        client = get_client()
        _collection = client.get_or_create_collection(
            name="safeher_knowledge",
            metadata={
                "hnsw:space": "cosine",
                "description": "SafeHer bilingual safety knowledge base",
            },
        )
        doc_count = _collection.count()
        logger.info(f"ChromaDB collection 'safeher_knowledge': {doc_count} documents")
    return _collection


def seed_if_empty():
    """
    Auto-seed the knowledge base on first startup if empty.
    This runs during FastAPI lifespan startup.

    Idempotent: uses upsert, so re-running is safe.
    """
    collection = get_collection()
    if collection.count() > 0:
        logger.info(f"Knowledge base already seeded ({collection.count()} docs). Skipping.")
        return

    logger.info("Knowledge base empty — seeding with bilingual safety data...")

    from rag.seed_data import get_all_entries
    from rag.embeddings import BengaliEmbedder

    entries = get_all_entries()
    embedder = BengaliEmbedder.get()

    # Prepare data for ChromaDB
    texts = [entry["text"] for entry in entries]
    ids = [entry["id"] for entry in entries]
    metadatas = [
        {"category": entry["category"], "lang": entry["lang"]}
        for entry in entries
    ]

    # Embed all texts
    logger.info(f"Embedding {len(texts)} documents...")
    embeddings = embedder.encode(texts)

    # Upsert into ChromaDB
    collection.upsert(
        documents=texts,
        ids=ids,
        metadatas=metadatas,
        embeddings=embeddings,
    )

    logger.info(f"✓ Seeded {len(entries)} documents into ChromaDB")


def get_collection_stats() -> dict:
    """Return collection statistics for health checks."""
    try:
        collection = get_collection()
        return {
            "document_count": collection.count(),
            "collection_name": "safeher_knowledge",
        }
    except Exception as e:
        return {"error": str(e), "document_count": 0}