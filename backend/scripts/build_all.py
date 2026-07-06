"""
SafeHer — One-shot precomputation runner
=========================================
Builds every artifact the backend needs *once*, so the running server
doesn't pay the cost on every boot.

Outputs (under backend/data/):
  - chittagong_walk.graphml  : scored walk graph (~25 MB)
  - chittagong_incidents.geojson : curated hotspot map for the heatmap layer
  - safeher_local.db        : SQLite with incidents + circles (auto-created)

Usage (from backend/):
    python scripts/build_all.py

This wraps:
  - precompute/build_graph.py       (5-15 min — OSM download + KDE scoring)
  - precompute/seed_incidents.py    (~10s — copies the hotspot GeoJSON)
  - precompute/build_knowledge_base.py  (~30s — seeds ChromaDB; usually auto on first boot)

If a step fails it logs the error and continues, so partial progress
is still useful for the demo.
"""

import logging
import subprocess
import sys
import os
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("safeher.build_all")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PRECOMPUTE = BACKEND_ROOT / "precompute"


def run(script_name: str) -> bool:
    """Run a precompute script as a subprocess; return True on success."""
    script = PRECOMPUTE / script_name
    if not script.exists():
        logger.warning(f"Skipping {script_name}: file missing")
        return False
    logger.info(f"→ Running {script_name} ...")
    t0 = time.time()
    try:
        subprocess.check_call([sys.executable, str(script)], cwd=str(BACKEND_ROOT))
        logger.info(f"✓ {script_name} done in {time.time() - t0:.1f}s")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"✗ {script_name} failed: {e}")
        return False


def main():
    logger.info("Building SafeHer artifacts in %s", BACKEND_ROOT)
    os.makedirs(BACKEND_ROOT / "data", exist_ok=True)

    results = {
        "graph": run("build_graph.py"),
        "incidents": run("seed_incidents.py"),
        "knowledge_base": run("build_knowledge_base.py"),
    }

    logger.info("=" * 50)
    for name, ok in results.items():
        logger.info(f"  {'✓' if ok else '✗'}  {name}")
    logger.info("=" * 50)

    if not results["graph"]:
        logger.warning(
            "Graph build failed. The /route endpoint will return 503 until "
            "you run precompute/build_graph.py successfully and the "
            "data/chittagong_walk.graphml file exists."
        )
    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()