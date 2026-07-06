"""
SafeHer — Bengali Sentence Embedder
======================================
Singleton wrapper around the l3cube-pune/bengali-sentence-similarity-sbert model.

Why this model:
  - Empirically best for Bengali RAG retrieval (verified by Bangla-RAG/PoRAG project)
  - SBERT-based → produces sentence-level vectors directly (no pooling needed)
  - Handles code-mixed Bengali-English better than monolingual models
  - ~80MB RAM → fits on Render's 512MB free tier alongside FastAPI

Fallback: If the Bengali model fails to load (RAM, network), falls back to
all-MiniLM-L6-v2 which is smaller and works for English queries.
The fallback produces lower-quality Bengali retrieval but doesn't crash.

Usage:
    embedder = BengaliEmbedder.get()
    vectors = embedder.encode(["কেউ আমাকে অনুসরণ করছে"])
"""

import logging
from typing import List, Optional

logger = logging.getLogger("safeher.embeddings")

# Lazy import to speed up startup
_SentenceTransformer = None


def _get_sentence_transformer():
    global _SentenceTransformer
    if _SentenceTransformer is None:
        from sentence_transformers import SentenceTransformer
        _SentenceTransformer = SentenceTransformer
    return _SentenceTransformer


class BengaliEmbedder:
    """
    Singleton Bengali sentence embedder.

    Thread-safe: SentenceTransformer.encode() is thread-safe for inference.
    The singleton pattern ensures the model is loaded only once at startup.
    """
    _instance: Optional["BengaliEmbedder"] = None

    # Primary model (Bengali-optimized)
    PRIMARY_MODEL = "l3cube-pune/bengali-sentence-similarity-sbert"
    # Fallback model (smaller, English-focused but works for RAG)
    FALLBACK_MODEL = "all-MiniLM-L6-v2"

    @classmethod
    def get(cls) -> "BengaliEmbedder":
        """Get or create the singleton embedder instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        """
        Load the embedding model.
        Tries Bengali SBERT first, falls back to MiniLM if that fails.
        """
        SentenceTransformer = _get_sentence_transformer()

        self.model = None
        self.model_name = None
        self.is_fallback = False

        # Try primary Bengali model
        try:
            logger.info(f"Loading primary embedding model: {self.PRIMARY_MODEL}")
            self.model = SentenceTransformer(self.PRIMARY_MODEL)
            self.model_name = self.PRIMARY_MODEL
            logger.info(f"✓ Primary model loaded: {self.PRIMARY_MODEL}")
        except Exception as e:
            logger.warning(f"Primary model failed to load: {e}")
            logger.info(f"Falling back to: {self.FALLBACK_MODEL}")

            try:
                self.model = SentenceTransformer(self.FALLBACK_MODEL)
                self.model_name = self.FALLBACK_MODEL
                self.is_fallback = True
                logger.info(f"✓ Fallback model loaded: {self.FALLBACK_MODEL}")
            except Exception as e2:
                logger.error(f"Both embedding models failed to load: {e2}")
                raise RuntimeError(
                    "Cannot load any embedding model. "
                    "Ensure sentence-transformers is installed and you have internet access."
                ) from e2

    def encode(self, texts: List[str]) -> List[List[float]]:
        """
        Encode texts into dense vectors.

        Args:
            texts: List of text strings to encode

        Returns:
            List of embedding vectors (each is a list of floats)

        Edge cases:
            - Empty list → returns empty list
            - Single text → works fine (batch of 1)
            - Very long text → SentenceTransformer truncates to model's max_seq_length
        """
        if not texts:
            return []

        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,  # L2 normalize for cosine similarity
            show_progress_bar=False,    # Silent in production
            batch_size=32,              # Efficient batching
        )
        return embeddings.tolist()

    def encode_single(self, text: str) -> List[float]:
        """Convenience method for encoding a single text."""
        return self.encode([text])[0]

    @property
    def embedding_dimension(self) -> int:
        """Return the dimensionality of the embedding vectors."""
        return self.model.get_sentence_embedding_dimension()

    def get_info(self) -> dict:
        """Return model info for health checks."""
        return {
            "model_name": self.model_name,
            "is_fallback": self.is_fallback,
            "embedding_dim": self.embedding_dimension,
        }
