Good. I have all the verified links. Now building the clean reference table.Five tabs, one for each category. Here is the plain summary so you know exactly what to download and when.

---

**Download these right now (before you write any code):**

CrimeDataBD at `data.mendeley.com/datasets/d7vzpcdzcw/4` — this is your most important file. It is a single CSV with 6,574 Bangladesh crime records. Filter for `victim_gender == "female"` and you have your incident density training data.

Bangladesh Police historical data at `github.com/mjtbasif/Bangladesh-Crime-Data` — one CSV per year from 2010 to 2019. Download these to cross-validate your KDE model and for your Model and Data Card.

**These you do not download — you install or call via API:**

OpenStreetMap data for Bangladesh is available from Geofabrik, but for your case you do not need to download it manually. You run `ox.graph_from_place("Chittagong, Bangladesh", network_type="walk")` once locally and it pulls exactly what you need through the Overpass API, which is a read-only API that serves custom selected parts of OSM map data.

The l3cube Bengali SBERT model is on HuggingFace at `l3cube-pune/bengali-sentence-similarity-sbert` — it installs via `pip install sentence-transformers` and downloads automatically the first time your code runs.

The Groq API key comes from `console.groq.com`. Free account, no card required.

**These you only read and cite, never download:**

The SafetiPin paper "an innovative mobile app to collect data on women's safety in Indian cities" is published in Gender and Development 2015 at `doi.org/10.1080/13552074.2015.1013669`. Your safety score weights are derived from their nine-parameter framework. Cite this paper in your Model and Data Card when a judge asks why your weights are 0.35/0.40/0.25.

The PoRAG project at `github.com/Bangla-RAG/PoRAG` is the source for your embedding model choice — they tested three Bengali embedding models and the l3cube model won. Cite this when explaining why you chose that embedder over BanglaBERT.