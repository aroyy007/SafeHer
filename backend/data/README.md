# Backend `data/` directory

This directory contains runtime + build-time artifacts for SafeHer.

## Generated files (NOT checked into git normally)

| File | Produced by | When | Size |
|---|---|---|---|
| `chittagong_walk.graphml` | `precompute/build_graph.py` | One-time, before first deploy | ~25 MB |
| `chittagong_incidents.geojson` | `precompute/seed_incidents.py` | One-time | ~50 KB |
| `safeher_local.db` | `db/local_db.init_db()` | Auto on first boot | <1 MB |
| `../chroma_store/` | `rag/knowledge_base.seed_if_empty()` | Auto on first boot | ~30 MB |

## Source data (checked in)

| File | What | Source |
|---|---|---|
| `crimedatabd.csv` | 6,574 Bangladesh crime records | Public dataset |

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
python precompute/seed_incidents.py     # ~10s
python precompute/build_knowledge_base.py  # ~30s — usually auto on first boot
```

After these run, start the backend:

```bash
uvicorn main:app --reload
```

`/health` should report `graph.loaded=true` and `knowledge_base.document_count > 0`.
