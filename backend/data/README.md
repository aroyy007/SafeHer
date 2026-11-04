# Backend `data/` directory

This directory contains runtime + build-time artifacts for SafeHer.

## Generated files (NOT checked into git normally)

| File | Produced by | When | Size |
|---|---|---|---|
| `chittagong_walk.graphml` | `precompute/build_graph.py` | One-time, before first deploy | ~25 MB |
| `safeher_local.db` | `db.local_db.init_db()` | Auto on first boot; Docker Compose stores it in a separate named volume | <1 MB |
| `../chroma_store/` | `rag/knowledge_base.seed_if_empty()` | Auto on first boot | ~30 MB |

The `/heatmap/` API aggregates the canonical crime CSV into approximate
~1 km cells on first request and caches the result in process memory. It works
in Lite Mode and does not require a generated GeoJSON file. The heatmap and
route precompute use the same configured Chattogram center and radius.

## Source data (checked in)

| File | What | Source |
|---|---|---|
| `crimedatabd.csv` | 6,574 Bangladesh crime records | CrimeDataBD v4, CC BY-NC 4.0; see `../../datasets.md` |

CrimeDataBD is news-derived with approximate coordinates. It does not include
victim gender or year, so do not apply a female-only filter or claim year-based
trends. The route precompute and heatmap limit the records to the configured
5 km area around Chattogram.

> NOTE: `chittagong_walk.graphml` is generated. For the hackathon demo
> we recommend generating it locally and committing it (or building at
> deploy time on Render if free-tier startup budget allows).

## One-shot build

From `backend/`:

```bash
# All at once
python scripts/build_all.py

# Or step by step
python precompute/build_graph.py        # 5-15 min — OSM download + KDE scoring
python precompute/build_knowledge_base.py  # ~30s — usually auto on first boot
```

After these run, start the backend:

```bash
uvicorn main:app --reload
```

`/health` should report `graph.loaded=true` and `knowledge_base.document_count > 0`.
