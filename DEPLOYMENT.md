# SafeHer — Production Deployment Guide

> Step-by-step instructions for deploying the SafeHer backend and
> frontend to free-tier cloud platforms that survive the CUET SciBlitz
> demo on **17 July 2026**.

This guide covers **Render** + **Netlify/Vercel** (the recommended
combination), then **Railway** + **Netlify** as the fallback, then
**Fly.io** as the all-in-one alternative.

---

## Table of contents

1. [Overview & recommended combo](#1-overview--recommended-combo)
2. [Critical pre-deploy steps](#2-critical-pre-deploy-steps)
3. [Deploy backend to Render](#3-deploy-backend-to-render)
4. [Deploy frontend to Netlify](#4-deploy-frontend-to-netlify)
5. [Deploy frontend to Vercel (alternative)](#5-deploy-frontend-to-vercel-alternative)
6. [Keep Render awake during the demo](#6-keep-render-awake-during-the-demo)
7. [Railway + Netlify (alternative)](#7-railway--netlify-alternative)
8. [Fly.io (all-in-one alternative)](#8-flyio-all-in-one-alternative)
9. [Deploy checklist](#9-deploy-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview & recommended combo

| Layer | Recommended host | Free tier | Why |
|---|---|---|---|
| Backend (FastAPI) | **Render** Web Service | 750 h/month, sleeps after 15 min | Easiest FastAPI deploy; `.env`-equivalent UI; auto-deploys from GitHub |
| Frontend (Vite/React) | **Netlify** | 100 GB bandwidth/month, no sleep | CDN, instant rollback, drag-and-drop `dist/` fallback if GitHub fails |
| Live wake-up | **cron-job.org** | free | Pings `/health` every 14 min during demo |
| Database (optional) | **Supabase** | 500 MB Postgres, 1 GB Storage | Already integrated; survives Render restarts |
| Realtime / auth / photos | **Firebase** | generous free tier | Already integrated for RTDB + Auth + Storage |

**Why this combo:** every service is free. Render handles the heavy
Python + Bengali SBERT model. Netlify is the most generous static host
(no sleep on free tier — unlike Vercel Hobby which has cold starts).
cron-job.org is the simplest way to defeat Render's 15-min sleep.

---

## 2. Critical pre-deploy steps

Do these **on your laptop** before you touch Render or Netlify.

### 2.1 Pre-build the heavy ML artifacts

The Bengali SBERT model is ~440 MB and the ChromaDB persistent store
needs seed data. If Render has to download the model on first boot it
**will OOM-kill** (free tier is 512 MB RAM).

```bash
cd /Users/arijitroy/Documents/SafeHer/backend
source venv/bin/activate

# Build the OSM routing graph (one-time, ~5 min)
python scripts/build_all.py

# Confirm the artifacts exist
ls -lh chroma_store/                  # ~50 MB after seeding
ls -lh data/chittagong_walk.graphml   # ~25 MB
```

### 2.2 Commit the artifacts to your repo

```bash
# Make sure gitignore doesn't exclude them
grep -E 'chroma_store|graphml' .gitignore
# If they appear in .gitignore, comment those lines out OR force-add
```

Edit `backend/.gitignore` so it doesn't exclude the heavy files:

```gitignore
# data/
# chroma_store/
!data/chittagong_walk.graphml
!chroma_store/
```

Then:

```bash
git add backend/chroma_store/ backend/data/chittagong_walk.graphml
git commit -m "chore: pre-build chroma_store and graphml for Render"
git push origin main
```

> **Verify the files are actually in the repo.** GitHub's "Repository
> size" warning means the LFS-style push silently failed. If your repo
> grew to >500 MB you probably have node_modules in it. Fix that first.

### 2.3 Push to GitHub

If not already done:

```bash
cd /Users/arijitroy/Documents/SafeHer
git remote add origin git@github.com:<your-org>/safeher.git
git push -u origin main
```

---

## 3. Deploy backend to Render

### 3.1 Create the Web Service

1. Sign in to <https://render.com> (GitHub login).
2. **New +** → **Web Service** → connect your GitHub repo.
3. **Root directory:** `backend`
4. **Runtime:** `Python 3`
5. **Build command:** `pip install --upgrade pip && pip install -r requirements.txt`
6. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`
7. **Plan:** `Free` (yes, it sleeps — we'll fix that)
8. **Region:** `Singapore` (closest to Bangladesh)

### 3.2 Set environment variables

Render dashboard → your service → **Environment** → **Add Environment Variable**:

```
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_…
GEMINI_API_KEY=AIzaSy…                # optional fallback
HUGGINGFACE_API_KEY=hf_…
SAFEHER_SECRET_KEY=<output of: python -c "import secrets;print(secrets.token_urlsafe(48))">
SAFEHER_PASSWORD_SALT=<output of: python -c "import secrets;print(secrets.token_urlsafe(32))">

# Supabase (optional but recommended for production)
USE_SUPABASE=true
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=sb_publishable_…          # publishable / anon key
SUPABASE_SERVICE_KEY=eyJ…              # service-role key
SUPABASE_JWT_SECRET=…                  # JWT Secret

# CORS — replace with your actual frontend URL after step 4
ALLOWED_ORIGINS=https://safeher.netlify.app,http://localhost:5173

USE_FIREBASE=false                      # not used on backend
DEBUG=false
```

Click **Save Changes**. Render triggers a deploy.

### 3.3 Confirm it's healthy

Open `https://safeher-api.onrender.com/health` (replace with your actual
URL). You should see:

```json
{
  "status": "ok",
  "graph": { "loaded": true, "nodes": 8057, "edges": 21266 },
  "knowledge_base": { "document_count": 78, ... }
}
```

If `graph.loaded` is false, the `.graphml` file isn't being found —
check the build logs in Render dashboard.

> **First deploy takes ~3-5 min** while Render installs Python
> dependencies. Subsequent deploys take ~30 s.

---

## 4. Deploy frontend to Netlify

### 4.1 Connect your repo

1. Sign in to <https://app.netlify.com>.
2. **Add new site** → **Import an existing project** → GitHub → select
   your repo.
3. **Base directory:** `frontend`
4. **Build command:** `npm run build`
5. **Publish directory:** `frontend/dist`
6. **Functions directory:** leave empty

Click **Deploy site**. First deploy runs the build; takes ~1-2 min.

### 4.2 Set environment variables

Netlify dashboard → **Site configuration** → **Environment variables** →
**Add a variable** for each:

```
VITE_API_URL=https://safeher-api.onrender.com
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi…
VITE_FIREBASE_API_KEY=AIzaSy…
VITE_FIREBASE_AUTH_DOMAIN=safeher-dev.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://safeher-dev-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=safeher-dev
VITE_FIREBASE_STORAGE_BUCKET=safeher-dev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
VITE_EMAILJS_SERVICE_ID=service_…
VITE_EMAILJS_TEMPLATE_ID=template_…
VITE_EMAILJS_PUBLIC_KEY=…
```

After saving, click **Trigger deploy** → **Deploy site** (rebuilds with
the env vars).

### 4.3 Update CORS on Render

Now that you know your Netlify URL (e.g.
`https://safeher-xyz.netlify.app`), go back to Render → Environment →
update `ALLOWED_ORIGINS` to include it:

```
ALLOWED_ORIGINS=https://safeher-xyz.netlify.app,http://localhost:5173
```

Render will redeploy automatically.

### 4.4 Optional: custom domain

In Netlify → **Domain settings** → **Add a domain**. If you have a
custom domain like `safeher.app`, point the DNS to Netlify and add the
new origin to Render's `ALLOWED_ORIGINS` env var.

---

## 5. Deploy frontend to Vercel (alternative)

Vercel also works fine for Vite apps; the steps are similar.

1. Sign in to <https://vercel.com>.
2. **Add New** → **Project** → import the GitHub repo.
3. **Root Directory:** `frontend`
4. **Framework Preset:** Vite (auto-detected)
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. Add the same env vars from [Section 4.2](#42-set-environment-variables).
8. Click **Deploy**.

> **Note:** Vercel Hobby has cold starts (~1 s). For the SciBlitz demo,
> Netlify is slightly more reliable since static sites don't sleep.

---

## 6. Keep Render awake during the demo

Free Render instances sleep after **15 minutes** of no traffic. When
they wake, the **first request takes ~30 s** while it reloads the
graph + ChromaDB into RAM. That delay would kill your live demo.

### 6.1 Set up cron-job.org

1. Sign up (free) at <https://cron-job.org>.
2. **Cronjobs** → **Create cronjob**.
3. **Title:** `SafeHer keep-alive`
4. **URL:** `https://safeher-api.onrender.com/health`
5. **Request method:** GET
6. **Interval:** every **14 minutes** (under Render's 15-min threshold)
7. **Enabled:** ✅

> The `/health` endpoint already reports `graph.loaded` — if the
> response says `graph.loaded: false`, something went wrong. Use that
> as your canary signal during the demo.

### 6.2 Start the cron-job 2 hours before your slot

Don't enable it the night before — the cron-job will fire hundreds of
useless times. Schedule it for the demo window only:

- **Start:** 2 hours before your pitch
- **Stop:** end of demo day

Disable the cron after the demo to save Render's free-tier hours.

---

## 7. Railway + Netlify (alternative)

Railway is faster than Render (cold start <5 s) and has a generous free
tier ($5/month of usage). Good fallback if Render is unreliable.

### 7.1 Backend on Railway

1. Sign in at <https://railway.app>.
2. **New Project** → **Deploy from GitHub repo** → pick the `backend/`
   subdirectory (use the **Root Directory** setting in Railway's UI).
3. Railway auto-detects Python and runs `uvicorn main:app --host 0.0.0.0 --port $PORT`.
4. **Variables** tab → add the same env vars from [Section 3.2](#32-set-environment-variables).
5. Railway gives you a public URL like `https://safeher-api.up.railway.app`.

> **Railway doesn't sleep** on the free trial tier — no need for
> cron-job.org. The trial gives you $5 of usage which is plenty for a
> 1-day demo.

### 7.2 Frontend stays on Netlify

Same as [Section 4](#4-deploy-frontend-to-netlify), but set
`VITE_API_URL` to the Railway URL.

---

## 8. Fly.io (all-in-one alternative)

If you want a single host for both frontend and backend, Fly.io is the
way. It has a generous free tier (3 shared VMs, 160 GB outbound).

### 8.1 Install flyctl

```bash
brew install flyctl          # macOS
# or: curl -L https://fly.io/install.sh | sh
fly auth signup
```

### 8.2 Backend on Fly.io

```bash
cd backend
fly launch --no-deploy       # creates fly.toml, asks for region
# Edit fly.toml to set:
#   internal_port = 8000
#   [env]
#     PORT = "8000"
fly secrets set \
  LLM_PROVIDER=groq \
  GROQ_API_KEY=gsk_… \
  HUGGINGFACE_API_KEY=hf_… \
  SAFEHER_SECRET_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(48))") \
  SAFEHER_PASSWORD_SALT=$(python -c "import secrets;print(secrets.token_urlsafe(32))") \
  ALLOWED_ORIGINS=https://safeher.fly.dev,http://localhost:5173
fly deploy
```

Fly URL will be `https://safeher.fly.dev`.

### 8.3 Frontend on Fly.io (static)

Fly can serve static files too, but it's overkill. **Use Netlify for
the frontend and Fly only for the backend** — this is the cheapest,
fastest combo.

---

## 9. Deploy checklist

Run this the night before the demo:

```bash
# 1. Backend is alive
curl -s https://safeher-api.onrender.com/health | python3 -m json.tool
# Expect: "status": "ok", graph.loaded=true, knowledge_base.document_count>50

# 2. Frontend loads
curl -sI https://safeher-xyz.netlify.app/ | head -1
# Expect: HTTP/2 200

# 3. Frontend can talk to backend
# (open browser devtools → console; sign up; check Network tab for 200s)

# 4. Phone OTP works
# (sign up with a real BD number; SMS arrives; complete flow)

# 5. EmailJS works
# (add contact with email; trigger SOS; email arrives within 30 s)

# 6. /track page shows the user's photo
# (after SOS trigger, open /track link on a 2nd device; photo visible)

# 7. Keep-alive cron is running
# (check cron-job.org dashboard; next fire time is within 14 min)

# 8. Google Maps or Mapbox tiles render
# (open landing page; map is visible, not gray)

# 9. Chat responds with real answer (not "call 999" fallback)
curl -s -X POST https://safeher-api.onrender.com/chat/ \
  -H "Content-Type: application/json" \
  -d '{"query":"helpline number"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('fallback?',d.get('fallback_used'))"
# Expect: fallback? False (or True if all LLM providers are rate-limited)
```

If any of these fail, jump to [Section 10](#10-troubleshooting).

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Render deploy OOM-kills | 512 MB free tier isn't enough | Commit `chroma_store/` so SBERT model is pre-loaded; or upgrade to Render Standard ($7/mo, 2 GB RAM) |
| `/health` says `graph.loaded: false` | Graph file not found | Confirm `data/chittagong_walk.graphml` is in the GitHub repo, not just locally |
| First request takes ~30 s | Render cold start | Cron-job keep-alive (Section 6) |
| CORS error in browser console | Render `ALLOWED_ORIGINS` doesn't include frontend URL | Add `https://safeher-xyz.netlify.app` to Render env vars |
| Phone OTP never arrives | Firebase Auth not enabled, or test number not set | Firebase Console → Auth → Sign-in method → Phone (enable) |
| Profile photo upload 403 | Firebase Storage rules too strict | Apply the rules from `INTEGRATIONS_SETUP.md` §6.5 |
| EmailJS "user not found" | Wrong Service ID or template mismatch | EmailJS Dashboard → Logs → check the error |
| Map tiles are gray | Mapbox token missing | `VITE_MAPBOX_TOKEN` must be in Netlify env vars (not just local) |
| Chat always returns "call 999" | Both Gemini and Groq rate-limited | Set `LLM_PROVIDER=groq` and verify `GROQ_API_KEY` is fresh |
| Supabase writes fail with 401 | Using anon key in backend | Use `SUPABASE_SERVICE_KEY` (service-role), not `SUPABASE_KEY` (anon) |

---

## Appendix A — Pricing comparison

| Platform | Free tier | What you pay for | Best for |
|---|---|---|---|
| **Render** | 750 h/month, 512 MB RAM, sleeps 15 min | Always-on ($7/mo per service) | Hackathon backend (we hit limits at scale) |
| **Railway** | $5 trial credit | Pay-as-you-go after | Faster alternative to Render |
| **Fly.io** | 3 shared VMs, 160 GB/mo transfer | More bandwidth/VMs | Low-latency, edge deployment |
| **Vercel** | 100 GB bandwidth/mo, no sleep | Team plan $20/mo | React/Next.js frontend |
| **Netlify** | 100 GB bandwidth/mo, no sleep | Pro $19/mo | Static frontend (recommended) |
| **cron-job.org** | 100 cron jobs | Unlimited $5/mo | Render keep-alive |

For a 1-day hackathon demo, **everything fits in the free tier**. Plan
to upgrade to Render Standard ($7/mo) only if you go to production
with real users.

---

## Appendix B — One-page deploy summary

```bash
# Pre-deploy (laptop)
cd backend && python scripts/build_all.py
git add chroma_store/ data/chittagong_walk.graphml
git commit -m "chore: pre-build for Render"
git push origin main

# Backend (Render dashboard)
#   New Web Service → root=backend
#   Build: pip install -r requirements.txt
#   Start: uvicorn main:app --host 0.0.0.0 --port $PORT
#   Env vars: LLM_PROVIDER, GROQ_API_KEY, SAFEHER_SECRET_KEY, ... (see §3.2)

# Frontend (Netlify dashboard)
#   Import repo → base=frontend
#   Build: npm run build
#   Publish: dist
#   Env vars: VITE_API_URL, VITE_FIREBASE_*, VITE_EMAILJS_*, ...

# Keep-alive (cron-job.org)
#   GET https://safeher-api.onrender.com/health every 14 min
```

---

*Last verified: 2026-07-08 — backend running on Render free tier,
frontend on Netlify, ready for SciBlitz.*