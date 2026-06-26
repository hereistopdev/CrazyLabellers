# Deploy: Vercel (frontend) + Render (backend)

## Overview

| Service | Platform | Root directory |
|---------|----------|----------------|
| Frontend | [Vercel](https://vercel.com) | `frontend` |
| Backend API | [Render](https://render.com) | `backend` |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) | — |

---

## 1. MongoDB Atlas

1. Create a free cluster at MongoDB Atlas.
2. Create a database user and allow network access (`0.0.0.0/0` for Render).
3. Copy the connection string, e.g.:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/football-labeling?retryWrites=true&w=majority
   ```

---

## 2. Deploy backend on Render

### Option A: Blueprint (`render.yaml`)

1. Push this repo to GitHub.
2. In Render → **New** → **Blueprint** → connect the repo.
3. Set environment variables when prompted:
   - `MONGODB_URI` — Atlas connection string
   - `CLIENT_URL` — your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `JWT_SECRET` — long random string (Render can auto-generate)
   - `ALLOWED_ORIGINS` — optional, comma-separated extra origins

### Option B: Manual web service

1. **New** → **Web Service** → connect GitHub repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `USE_MEMORY_DB` | `false` |
| `MONGODB_URI` | Your Atlas URI |
| `JWT_SECRET` | Long random secret |
| `CLIENT_URL` | `https://your-app.vercel.app` |

4. Deploy and note your API URL, e.g. `https://football-labeling-api.onrender.com`

The database auto-seeds on first startup (terminology, tests, sample videos, admin user).

**Admin login:** `admin@labeling.local` / `admin123`

---

## 3. Deploy frontend on Vercel

1. Import the GitHub repo in Vercel.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment variable:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-api.onrender.com/api` |

Important: include the `/api` suffix.

4. Deploy.

`vercel.json` is included for React Router SPA routing.

---

## 4. Connect frontend ↔ backend

After both are live:

1. Set Render `CLIENT_URL` to your Vercel production URL.
2. Set Vercel `VITE_API_URL` to `https://your-api.onrender.com/api`.
3. Redeploy both if you change URLs.

CORS allows:
- `CLIENT_URL`
- `ALLOWED_ORIGINS` (comma-separated)
- Any `*.vercel.app` preview/production URL
- Localhost (dev only)

---

## 5. Verify deployment

```bash
# Backend health
curl https://your-api.onrender.com/api/health

# Terminology (public)
curl https://your-api.onrender.com/api/terminology
```

Open your Vercel URL → register → study terminology → take test.

---

## Local vs production

| | Local | Production |
|---|-------|------------|
| Frontend API | Vite proxy `/api` | `VITE_API_URL` |
| Database | `USE_MEMORY_DB=true` | MongoDB Atlas |
| CORS | `localhost:5173` | Vercel URL |

---

## Troubleshooting

**CORS error in browser**
- The backend allows `crazylabel.us`, origins in `CLIENT_URL` / `ALLOWED_ORIGINS`, matching `CORS_ALLOWED_DOMAINS`, and `*.vercel.app`.
- Set Render `CLIENT_URL` to the URL you open in the browser (e.g. `https://crazylabel.us`).
- Confirm Vercel `VITE_API_URL` is your live Render API (`https://YOUR-SERVICE.onrender.com/api`) and **redeploy Vercel** after changing it.
- Redeploy Render after changing env vars; check logs for `CORS allowed origins:`.
- If the Network tab shows a failed **OPTIONS** preflight, redeploy the latest backend (older builds blocked extra request headers).

**API unreachable from Vercel**
- Confirm `VITE_API_URL` ends with `/api`.
- Redeploy Vercel after changing env vars (Vite embeds them at build time).

**Render cold start**
- Free tier spins down after inactivity. First request may take ~30s.

**Empty database**
- First API start auto-seeds. Check Render logs for "Auto-seeded database on first run".
