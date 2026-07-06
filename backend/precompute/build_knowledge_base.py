"""
SafeHer — Knowledge Base Seeder Script
========================================
Manually builds the ChromaDB collection using the Bengali SBERT model.

You can run this offline before deployment.
The web server also runs this automatically on first startup if the DB is empty.
"""

import os
import sys
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger("build_kb")

# Add backend dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.knowledge_base import seed_if_empty

def main():
    logger.info("Initializing ChromaDB knowledge base...")
    try:
        seed_if_empty()
        logger.info("Knowledge base seeded successfully. Chroma store saved to disk.")
    except Exception as e:
        logger.error(f"Failed to seed knowledge base: {e}")

if __name__ == "__main__":
    main()
