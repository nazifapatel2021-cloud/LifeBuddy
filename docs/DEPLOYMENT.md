# LifeBuddy Deployment Guide

This guide describes how to run and deploy LifeBuddy locally and in production using Render Free Tier.

---

## 1. Cloud Deployment: Render (Free Tier Blueprint)

Render provides free hosting for web services with automatic TLS certificates and continuous deployment from GitHub.

### Step 1: Fork or Push Repository to GitHub
Ensure your repository is hosted on GitHub (`https://github.com/your-username/LifeBuddy`).

### Step 2: Connect Render Blueprint
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** ➔ **Blueprint**.
3. Select your `LifeBuddy` repository.
4. Render automatically parses `render.yaml` and configures the environment:
   - **Environment:** Python 3.12
   - **Build Command:** `pip install -r requirements.txt && python scripts/seed_demo.py`
   - **Start Command:** `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Auto-generated Secret:** `LIFEBUDDY_SECRET_KEY`

### Step 3: (Optional) Attach Render Managed PostgreSQL
1. In Render, click **New +** ➔ **PostgreSQL**.
2. Plan: **Free**.
3. Copy the **Internal Database URL** (`postgres://...`).
4. In your `lifebuddy-app` Environment settings, add `DATABASE_URL` with that value.
5. Trigger manual redeploy. LifeBuddy detects the `postgresql://` protocol and switches automatically.

---

## 2. Local Development

To run LifeBuddy locally on your machine:
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Seed realistic demo personas
python scripts/seed_demo.py

# 3. Start development server
python run.py
```
Open `http://localhost:8000` in your web browser.

---

## 3. Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URI or omitted for SQLite | `None` (uses `lifebuddy.db`) |
| `LIFEBUDDY_SECRET_KEY` | HMAC SHA-256 secret key for signing JWTs | Auto-generated in production |
| `ACCESS_TOKEN_EXPIRY_SECONDS` | Short-lived access token validity in seconds | `900` (15 minutes) |
| `REFRESH_TOKEN_EXPIRY_SECONDS` | Refresh token validity in seconds | `604800` (7 days) |
| `CORS_ORIGINS` | Permitted CORS origins, comma-separated or `*` | `*` |
| `PORT` | Listening web server port | `8000` |
