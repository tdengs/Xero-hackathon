# Getting PayTrace AI Running

This guide covers everything you need to go from zero to a working local instance.

---

## What You Need Before Starting

### Accounts to create

You need accounts on three external services. None cost money to get started.

**Xero (free developer account)**
1. Go to [developer.xero.com](https://developer.xero.com) and sign up
2. Create a new app under "My Apps"
3. Set the redirect URI to `http://localhost:8000/api/v1/auth/xero/callback`
4. Copy your **Client ID** and **Client Secret**
5. Under OAuth 2.0 scopes, enable: `openid`, `profile`, `email`, `accounting.banktransactions`, `accounting.invoices`, `accounting.manualjournals`, `accounting.contacts`, `offline_access`
6. You also need a free Xero Demo Company to test against — create one at [go.xero.com/app/signup](https://go.xero.com/app/signup)

**Stripe (use test mode)**
1. Sign up at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Stay in **Test mode** (toggle in the top-left)
3. Go to Developers → API keys → copy the **Secret key** (`sk_test_...`)
4. Go to Developers → Webhooks → Add endpoint: `http://localhost:8000/webhooks/stripe`
   - Select events: `payout.paid`, `charge.refunded`, `charge.dispute.created`
   - Copy the **Signing secret** (`whsec_...`)
   - Note: for local webhooks you'll need [Stripe CLI](#stripe-cli-for-local-webhooks)

**Anthropic**
1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to API Keys → Create key
3. Copy the key (`sk-ant-...`)
4. Add $5 credit — the app uses `claude-sonnet-4-6`, which costs ~$3 per 1M input tokens

### Software already on your machine

| Tool | Required version | You have |
|---|---|---|
| Python | 3.11+ | 3.11.5 ✓ |
| Node.js | 18+ | 22.1.0 ✓ |
| Docker Desktop | Any recent | Check below |
| Git | Any | Assumed |

Check Docker: `docker --version`. If not installed, get it from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).

---

## Step 1 — Create the .env file

In `backend/`, create a file called `.env`. Copy this template and fill in your values:

```env
# ── Database ────────────────────────────────────────────────────────────────
# When using Docker Compose this is set automatically — leave as-is
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/paytrace

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ── Xero OAuth ───────────────────────────────────────────────────────────────
XERO_CLIENT_ID=your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=http://localhost:8000/api/v1/auth/xero/callback
XERO_SCOPES=openid profile email accounting.banktransactions accounting.invoices accounting.manualjournals accounting.contacts offline_access

# ── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_API_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# ── Anthropic ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-6

# ── App Security ─────────────────────────────────────────────────────────────
# Generate both with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=replace_with_64_char_hex_string_generated_above
ENCRYPTION_KEY=replace_with_different_64_char_hex_string

# ── Runtime ──────────────────────────────────────────────────────────────────
ENVIRONMENT=development
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:5173"]
```

Generate `SECRET_KEY` and `ENCRYPTION_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
# Run twice, use different values for each
```

---

## Step 2 — Start the Backend with Docker

Docker handles PostgreSQL and Redis for you. From the `backend/` folder:

```bash
cd backend

# Start database and Redis only (recommended for development)
docker compose up db redis -d

# Verify they're healthy
docker compose ps
# Both should show "healthy"
```

Then run the API directly (easier to see logs and restart):

```bash
# Install Python dependencies
pip install -r requirements.txt

# Apply the database schema
psql postgresql://postgres:postgres@localhost:5432/paytrace -f migrations/001_initial.sql

# Start the API
uvicorn app.main:app --reload --port 8000

# In a second terminal, start the background worker
python -m arq app.workers.reconciliation_worker.WorkerSettings
```

The API is now at `http://localhost:8000`. Check it: `curl http://localhost:8000/health` should return `{"status":"ok"}`.

### Alternative: Run everything in Docker

If you prefer to run everything in containers:

```bash
cd backend
docker compose up --build
```

The API will be on port 8000, PostgreSQL on 5432, Redis on 6379.

---

## Step 3 — Start the Frontend

In a new terminal, from the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. You should see the PayTrace AI login screen.

The frontend proxies `/api` requests to `http://localhost:8000` automatically (configured in `vite.config.ts`).

---

## Step 4 — Stripe CLI for Local Webhooks

Stripe can't reach `localhost` directly for webhooks. Use the Stripe CLI to forward events:

```bash
# Install Stripe CLI
# Windows: winget install Stripe.StripeCLI
# Mac: brew install stripe/stripe-cli/stripe

stripe login

# Forward events to your local backend
stripe listen --forward-to localhost:8000/webhooks/stripe
```

The CLI will print a webhook signing secret like `whsec_abc123...`. Use this as `STRIPE_WEBHOOK_SECRET` in your `.env` (instead of the one from the dashboard). Restart the API after updating `.env`.

---

## Step 5 — Connect Your Accounts

1. Open `http://localhost:5173`
2. Register an account (POST `/auth/register`)
3. Click **Connect Xero** → you'll be redirected to Xero OAuth → authorise → redirected back
4. The app will automatically use your Xero Demo Company

Stripe does not require an OAuth connection. The app reads from your Stripe account using the `STRIPE_API_KEY` in `.env` directly. Once logged in, use the **Sync Payouts** button on the dashboard to pull your latest Stripe payouts, or simply click **Explain with AI** on any payout — the app will sync its transaction detail from Stripe automatically before running the AI analysis.

---

## Verifying Everything Works

```bash
# API health
curl http://localhost:8000/health
# → {"status":"ok","version":"1.0.0","environment":"development"}

# Database connection
curl http://localhost:8000/payouts
# → [] (empty list, no auth error = DB connected)

# Frontend
# Open http://localhost:5173 — should load the login page

# Stripe CLI — confirms webhook signature verification is working
stripe trigger payout.paid
# → API logs "stripe_payout_paid payout_id=..." (no auto-sync; sync happens on Explain with AI)
```

---

## Common Problems

**`asyncpg: connection refused`**  
Docker isn't running or the DB container isn't healthy yet. Run `docker compose ps` to check.

**`XeroAuthError: Refresh token expired`**  
Your Xero token expired (they last 30 minutes). Click "Reconnect Xero" in the app.

**`Xero OAuth redirect_uri mismatch`**  
The redirect URI in your Xero app settings must exactly match `XERO_REDIRECT_URI` in `.env`, including the trailing path. Check for trailing slashes.

**`Stripe webhook signature invalid`**  
Make sure `STRIPE_WEBHOOK_SECRET` is the Stripe CLI secret (`whsec_...` from `stripe listen` output), not the dashboard secret. They're different.

**`ENCRYPTION_KEY must be at least 32 characters`**  
Generate it properly: `python -c "import secrets; print(secrets.token_hex(32))"` produces 64 hex characters, which is fine.

**Frontend shows blank page**  
Open browser devtools → Console. Usually a Vite proxy error if the backend isn't running on port 8000.

**`arq.Worker: no functions`**  
The worker command must point to the correct class. Use exactly:  
`python -m arq app.workers.reconciliation_worker.WorkerSettings`

---

## Project Structure Quick Reference

```
xero/
├── backend/
│   ├── .env                  ← you create this (not committed)
│   ├── requirements.txt      ← pip install -r requirements.txt
│   ├── docker-compose.yml    ← docker compose up db redis -d
│   ├── migrations/
│   │   └── 001_initial.sql   ← run once to create tables
│   └── app/
│       ├── main.py           ← FastAPI entry point (uvicorn app.main:app)
│       ├── config.py         ← reads from .env
│       ├── models/           ← SQLAlchemy database models
│       ├── routers/          ← API endpoint handlers
│       ├── services/
│       │   ├── xero_service.py   ← all Xero API calls
│       │   ├── stripe_service.py ← all Stripe API calls
│       │   └── ai_agent.py       ← Claude reconciliation agent
│       ├── utils/            ← retry, encryption, idempotency, audit
│       └── workers/
│           └── reconciliation_worker.py  ← background AI jobs
└── frontend/
    ├── package.json          ← npm install
    ├── vite.config.ts        ← proxies /api → localhost:8000
    └── src/
        ├── services/api.ts   ← all API calls
        ├── hooks/            ← React Query hooks
        └── components/       ← UI components
```
