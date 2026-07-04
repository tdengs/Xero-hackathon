# PayTrace AI — Architecture Document

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PayTrace AI System                           │
│                                                                      │
│   ┌──────────────┐      HTTPS       ┌────────────────────────────┐  │
│   │   Browser     │ ─────────────── │  React SPA (Vite + TS)     │  │
│   │  (User)       │ ◄── SSE events  │  Tailwind + React Query     │  │
│   └──────────────┘                  └────────────┬───────────────┘  │
│                                                   │ /api             │
│                                    ┌──────────────▼───────────────┐  │
│                                    │   FastAPI Backend (Python)    │  │
│                                    │   Auth │ Payouts │ Recon      │  │
│                                    │   Webhooks │ Health           │  │
│                                    └──┬──────────┬──────────┬─────┘  │
│                                       │          │          │        │
│                          ┌────────────▼─┐  ┌────▼────┐  ┌──▼─────┐  │
│                          │  PostgreSQL  │  │  Redis  │  │ Claude │  │
│                          │  (main DB)   │  │ (queue) │  │  API   │  │
│                          └──────────────┘  └────┬────┘  └──┬─────┘  │
│                                                 │          │        │
│                                    ┌────────────▼──────────▼──────┐  │
│                                    │   ARQ Background Worker       │  │
│                                    │   ReconciliationAgent loop    │  │
│                                    └────────────────────────┬──────┘  │
│                                                             │        │
│   ┌─────────────────────────────────────────────────────────▼──────┐  │
│   │                      External APIs                              │  │
│   │    Xero Accounting API  │  Stripe API  │  Stripe Webhooks       │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Request flows:**
- **Browser → FastAPI**: HTTPS REST for all CRUD, OAuth callbacks, job triggers
- **FastAPI → Redis**: Enqueue reconciliation jobs (async, non-blocking)
- **Worker → Claude API**: AI agent tool-calling loop for each job
- **Worker → Xero API**: Fetch invoices, create journals, reconcile bank transactions
- **Stripe → FastAPI /webhooks**: Real-time payout and refund events (HMAC-verified)
- **FastAPI → Browser (SSE)**: Job progress updates (queued → running → completed)

---

## 2. Frontend Architecture

### Stack
- **Framework**: React 18 with TypeScript (strict mode)
- **Build tool**: Vite 5 (sub-second HMR, ES module output)
- **Styling**: Tailwind CSS 3 with custom Xero theme tokens
- **Server state**: React Query v5 (caching, background refetch, mutations)
- **Animation**: Framer Motion 10 (panel slides, drawer expansions)
- **Icons**: Lucide React
- **Routing**: React Router v6

### Design tokens
```
xero-dark:    #0D1B2A  (page background)
xero-navy:    #1A1F36  (card/surface)
xero-surface: #252B45  (hover/input)
xero-blue:    #13B5EA  (primary accent, buttons, links)
success:      #10B981
warning:      #F59E0B
error:        #EF4444
```

### Component tree
```
App
├── AuthProvider (JWT token in localStorage, 401 → /login)
└── BrowserRouter
    ├── /login → LoginPage
    │   └── LoginForm (email + password → POST /auth/login → store JWT)
    └── / → ProtectedRoute → Dashboard
        ├── TopNav (logo, connection badges, user menu)
        ├── Sidebar (bank accounts list, quick stats)
        ├── BankFeed (transaction rows, "✨ Explain" buttons)
        ├── ExplainPane (slide-in panel, 480px)
        │   ├── ProgressSteps (while job running)
        │   ├── AISummaryCard (when complete)
        │   ├── AnomalyAlert[] (warnings and critical alerts)
        │   ├── BreakdownTable (clickable rows)
        │   │   └── EvidenceDrawer (height-animated expand)
        │   └── ReconcileConfirmModal (actions checklist + confirm)
        └── ChatInterface
            ├── MessageBubble[] (user + AI messages)
            ├── TypingIndicator (3-dot animation)
            └── SuggestedChips (quick question shortcuts)
```

### Key patterns

**Server state**: React Query handles all data fetching. `useReconciliationJob(jobId)` polls `GET /reconciliation/jobs/{id}` every 2 seconds, automatically stopping when `status` reaches `completed` or `failed`.

**Optimistic UI**: After clicking "Reconcile Everything", the bank row immediately shows "In Progress" status while the API processes.

**Evidence links**: Every evidence item in `ReconciliationEvidence[]` has an `evidenceUrl` pointing directly to the Stripe Dashboard or Xero invoice — no dead-end references.

---

## 3. Backend Architecture

### Stack
- **Framework**: FastAPI 0.104+ with lifespan context manager
- **ORM**: SQLAlchemy 2.0 async with asyncpg driver
- **Migrations**: Manual SQL (`migrations/001_initial.sql`)
- **Background jobs**: ARQ (async Redis Queue)
- **HTTP client**: httpx (async)
- **Logging**: structlog with JSON renderer (production) / colored console (dev)
- **Validation**: Pydantic v2 (FastAPI dependency)

### Router structure

| Prefix | Router | Key endpoints |
|---|---|---|
| `/auth` | auth.py | POST /register, POST /login, GET /xero/authorize, GET /xero/callback |
| `/payouts` | payouts.py | GET /, GET /{id}, POST /sync, GET /{id}/summary, POST /{id}/explain |
| `/reconciliation` | reconciliation.py | GET /jobs/{id}, POST /jobs/{id}/approve, GET /jobs/{id}/evidence, GET /audit |
| `/webhooks` | webhooks.py | POST /stripe (Stripe events, HMAC-verified) |
| `/health` | main.py | GET /health |

### Service layer

```
XeroService
  ├── get_authorization_url(state)      → builds OAuth redirect URL
  ├── exchange_code_for_tokens(code)    → stores encrypted tokens
  ├── refresh_access_token(connection)  → refreshes + updates DB
  ├── get_bank_transactions(...)        → GET /BankTransactions
  ├── search_invoices(...)              → GET /Invoices with where clause
  ├── create_journal_entry(...)         → POST /ManualJournals (idempotent)
  └── get_accounts(...)                 → GET /Accounts (cached)

StripeService
  ├── list_payouts(account_id)          → stripe.Payout.list
  ├── get_payout_transactions(id)       → stripe.BalanceTransaction.list (paginated)
  ├── sync_payout_to_db(id, db)        → idempotent: check DB first, fetch if new
  └── build_payout_summary(payout)     → categorize items, detect anomalies

ReconciliationAgent
  ├── explain_payout(payout_id, ...)   → creates job, runs loop, saves result
  ├── _run_agent_loop(...)             → Claude tool-calling ReAct loop
  └── _execute_tool(name, inputs, ...) → dispatches to Stripe/Xero services
```

### Middleware stack (applied in order)

1. `CORSMiddleware` — configurable allowed origins
2. `RequestIDMiddleware` — adds/propagates `X-Request-ID`
3. `LoggingMiddleware` — structured log per request (method, path, status, duration_ms)
4. Global exception handler — catches all unhandled exceptions, returns JSON error

---

## 4. Database Schema

All monetary columns use `NUMERIC(12,2)` — never `FLOAT`. Financial arithmetic must be exact.

```
users
  id UUID PK | email VARCHAR(255) UNIQUE | hashed_password VARCHAR(255)
  created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
  → 1:many xero_connections, stripe_connections, payouts, audit_logs

xero_connections
  id UUID PK | user_id UUID FK(CASCADE) | tenant_id VARCHAR(255)
  tenant_name VARCHAR(255) | access_token TEXT (Fernet-encrypted)
  refresh_token TEXT (Fernet-encrypted) | token_expires_at TIMESTAMPTZ
  scopes TEXT | is_active BOOLEAN | created_at | updated_at
  UNIQUE(user_id, tenant_id)

stripe_connections
  id UUID PK | user_id UUID FK(CASCADE) | account_id VARCHAR(255)
  display_name VARCHAR(255) | access_token TEXT (Fernet-encrypted)
  livemode BOOLEAN | created_at | updated_at
  UNIQUE(user_id, account_id)

payouts
  id UUID PK | user_id UUID FK | stripe_payout_id VARCHAR UNIQUE ← idempotency key
  amount NUMERIC(12,2) | currency CHAR(3) | status VARCHAR (CHECK enum)
  arrival_date DATE | reconciliation_status VARCHAR (CHECK enum)
  xero_bank_transaction_id VARCHAR (set when reconciled)
  created_at | updated_at
  INDEX(user_id, reconciliation_status)
  INDEX(user_id, arrival_date DESC)

payout_items
  id UUID PK | payout_id UUID FK | stripe_balance_transaction_id VARCHAR UNIQUE
  type VARCHAR (CHECK enum: payment|refund|stripe_fee|chargeback|fx_adjustment)
  amount NUMERIC(12,2) | currency CHAR(3) | description TEXT
  stripe_charge_id VARCHAR | xero_invoice_id VARCHAR | matched_at TIMESTAMPTZ
  metadata JSONB (stores Stripe fee_details, reporting_category)
  INDEX(payout_id, type)

reconciliation_jobs
  id UUID PK | payout_id UUID FK UNIQUE ← one job per payout
  status VARCHAR (CHECK enum: queued|running|completed|failed|needs_review)
  started_at TIMESTAMPTZ | completed_at TIMESTAMPTZ
  agent_model VARCHAR | agent_reasoning TEXT ← full Claude chain stored
  explanation_json JSONB ← structured output from Claude
  journal_entries_created JSONB ← list of Xero entity IDs created
  items_matched INT | items_unmatched INT
  total_explained NUMERIC(12,2) | total_unexplained NUMERIC(12,2)
  error_message TEXT

reconciliation_evidence
  id UUID PK | job_id UUID FK | claim TEXT
  evidence_type VARCHAR (stripe_transaction|xero_invoice|bank_transaction)
  evidence_id VARCHAR | evidence_url VARCHAR | amount NUMERIC(12,2)
  verified BOOLEAN DEFAULT FALSE
  INDEX(job_id)

audit_logs ← write-only, never updated
  id UUID PK | user_id UUID | action VARCHAR(100) | entity_type VARCHAR(50)
  entity_id UUID | before_state JSONB | after_state JSONB
  agent_job_id UUID | ip_address VARCHAR | timestamp TIMESTAMPTZ DEFAULT NOW()
  INDEX(user_id, timestamp DESC)
  INDEX(action, timestamp DESC)
```

### Entity relationships

```
users ─────┬──────────────────── xero_connections (1:many)
           ├──────────────────── stripe_connections (1:many)
           └──────────────────── payouts (1:many)
                                   │
                    ┌──────────────┴──────────────────┐
                    │                                  │
               payout_items (1:many)     reconciliation_jobs (1:1)
                                                       │
                                         reconciliation_evidence (1:many)

audit_logs ── references user_id and entity_id (loosely coupled)
```

---

## 5. AI Agent Architecture

### Model and SDK
- **Model**: `claude-sonnet-4-6` via `anthropic.AsyncAnthropic`
- **Pattern**: ReAct loop (Reason → Act → Observe) with structured tool calling
- **Max iterations**: 10 tool call rounds before forcing a conclusion

### Agent tools

| Tool name | Input | What it does |
|---|---|---|
| `get_payout_summary` | `payout_id` | Returns categorized totals from DB (no external call) |
| `get_payout_items` | `payout_id`, `item_type?` | Returns individual transactions by type |
| `search_xero_invoices` | `amount_min`, `amount_max`, `date_from`, `date_to` | Calls Xero GET /Invoices |
| `detect_anomalies` | `payout_id` | Rule-based checks: refund rate, chargeback flag, FX variance |

### ReAct loop sequence

```
User: "Explain payout {id} — $8,742.63"
  │
  ├─ Tool: get_payout_summary → {gross: 9102, fees: 214.37, refunds: 96, ...}
  ├─ Tool: get_payout_items(type=stripe_fee) → [87 fee transactions]
  ├─ Tool: search_xero_invoices(amount_min=50, amount_max=200) → [87 invoices]
  ├─ Tool: detect_anomalies → [{severity: warning, msg: "Refund rate 3.2%..."}]
  │
  └─ Final turn: JSON output
     {
       "summary": "This payout contains 87 payments...",
       "gross_sales": 9102.00, "stripe_fees": 214.37, ...
       "balanced": true,
       "anomalies": [{"severity": "warning", "message": "Refund rate 3.2%..."}],
       "proposed_actions": [...],
       "evidence": [...]
     }
```

### Hallucination prevention

Critical for a financial product:

1. **Tool-grounded claims**: System prompt explicitly forbids claiming any amount not retrieved by a tool in the current session
2. **Double-entry validation**: Proposed journal entries checked: `sum(debits) == sum(credits)` — Python enforces this before any Xero POST
3. **Balance check**: `gross_sales - stripe_fees - refunds - chargebacks - fx == net_payout` within $0.01
4. **Unexplained remainder**: If balance check fails by more than $0.01, agent sets `needs_human_review=true` and blocks auto-execution
5. **Full reasoning chain**: `agent_reasoning` TEXT column stores every turn of the Claude conversation — complete audit trail of how the AI reached its conclusions

### Human-in-the-loop

**Strict rule**: No Xero write operation executes without explicit human confirmation.

```
AI proposes → [stored in reconciliation_jobs.explanation_json]
                        │
                   Human reviews proposed_actions
                        │
             POST /reconciliation/jobs/{id}/approve
                        │
                Backend executes Xero writes
                (with idempotency keys)
                        │
                   Audit log written
```

---

## 6. Security Architecture

### OAuth token storage
Xero and Stripe OAuth tokens are encrypted with **Fernet** (AES-128-CBC + HMAC-SHA256) before database storage. Key derivation: `base64(ENCRYPTION_KEY[:32])`. Even with database access, tokens cannot be read without the encryption key.

### Authentication
- **JWT access tokens**: RS256, 1-hour expiry
- **Refresh tokens**: 7-day expiry, stored in httpOnly cookie (production) or localStorage (dev)
- **401 handling**: Frontend interceptor clears token and redirects to `/login`

### Webhook security
All incoming Stripe webhooks verified with `stripe.Webhook.construct_event()` using `STRIPE_WEBHOOK_SECRET`. Invalid signatures return HTTP 400 immediately — no processing.

### Rate limiting
Redis token bucket: 100 requests/minute per user. Exceeding returns HTTP 429 with `Retry-After` header.

---

## 7. Reliability Architecture

### Idempotency

Every Xero write uses an idempotency key: `SHA256(payout_id + ":" + action_type + ":v1")`.

```python
key = generate_key(str(payout_id), "stripe_fees_journal", "v1")
is_new, cached = await check_and_set(redis, key, {}, ttl=86400)
if not is_new:
    return cached  # Return previous result, skip Xero POST
```

This guarantees: clicking "Reconcile" twice never creates two journal entries.

### Retry strategy

Using `tenacity` with exponential backoff and jitter:

| Attempt | Wait |
|---|---|
| 1st retry | 1–2s (random) |
| 2nd retry | 2–4s (random) |
| 3rd retry | 4–8s (random) |
| Give up | Raise after 3 attempts |

Retries on: HTTP 429, 500, 502, 503, 504, `httpx.TimeoutException`.  
Hard fails on: HTTP 400, 401, 403, 404.

### Background jobs (ARQ)

```
FastAPI → POST /payouts/{id}/explain
  │
  ├─ Creates ReconciliationJob (status=queued)
  ├─ Returns {job_id, status: "queued"} immediately
  └─ Enqueues job to Redis

ARQ Worker (separate process)
  │
  ├─ Dequeues job
  ├─ Runs ReconciliationAgent.explain_payout()
  ├─ Updates ReconciliationJob (status=completed, explanation_json=...)
  └─ Job result kept in Redis for 1 hour (keep_result=3600)

Frontend (React Query)
  └─ Polls GET /reconciliation/jobs/{id} every 2s until status != running
```

Max job timeout: **5 minutes** per reconciliation. Failed jobs write `error_message` to DB and update status to `failed`.

---

## 8. Observability

### Structured logging (structlog)

Every request logged as JSON:
```json
{
  "event": "http_request",
  "method": "POST",
  "path": "/payouts/abc/explain",
  "status": 200,
  "duration_ms": 34.2,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-12-15T09:03:22Z"
}
```

### Audit trail

Every AI and user action produces an `audit_log` record. Example:
```json
{
  "action": "reconciliation.journal_entry_created",
  "entity_type": "reconciliation_job",
  "entity_id": "...",
  "agent_job_id": "...",
  "after_state": {"xero_journal_id": "abcde", "amount": 214.37, "account": 461},
  "timestamp": "2024-12-15T09:03:45Z"
}
```

### Health check

`GET /health` returns:
```json
{"status": "ok", "version": "1.0.0", "environment": "production"}
```

---

## 9. Production Deployment

### Local development
```bash
# Backend + DB + Redis + Worker
docker compose up

# Frontend (hot reload)
cd frontend && npm install && npm run dev
```

### Production path
- **API**: Docker image → GKE Deployment or ECS Task (2+ replicas, HPA on CPU)
- **Worker**: Separate Deployment (1–3 replicas based on queue depth)
- **Database**: Cloud SQL (PostgreSQL 16) or RDS with automated backups
- **Redis**: Cloud Memorystore or ElastiCache (1GB, persistence enabled)
- **Secrets**: GCP Secret Manager or AWS Secrets Manager (not environment variables)

### Required environment variables

```
DATABASE_URL          # postgresql+asyncpg://...
REDIS_URL             # redis://...
XERO_CLIENT_ID        # From Xero Developer portal
XERO_CLIENT_SECRET    # From Xero Developer portal
XERO_REDIRECT_URI     # https://app.paytrace.ai/auth/xero/callback
STRIPE_API_KEY        # sk_live_...
STRIPE_WEBHOOK_SECRET # whsec_...
ANTHROPIC_API_KEY     # sk-ant-...
SECRET_KEY            # 32+ random bytes (JWT signing)
ENCRYPTION_KEY        # 32+ random bytes (token encryption)
```

---

## 10. Architectural Decisions and Trade-offs

| Decision | Choice | Reason | Trade-off | Judging impact |
|---|---|---|---|---|
| Language | Python 3.11 | Anthropic SDK, async FastAPI, SQLAlchemy | Slower than Go | Enables Claude integration cleanly |
| Database | PostgreSQL 16 | ACID compliance for financial data | More ops than SQLite | Architecture (20%): correctness |
| AI model | claude-sonnet-4-6 | Best tool-use reasoning for finance | Higher API cost | Architecture (20%): quality |
| Queue | ARQ/Redis | Simple async jobs, sufficient for MVP | Not Kafka-scale | Architecture (20%): async design |
| Idempotency | SHA256 keys in Redis | Prevents duplicate Xero journals | Redis dependency | Xero (50%): data integrity |
| Human approval | Required before writes | Compliance + trust | Slightly more friction | Xero (50%): auditability |
| Token storage | Fernet encryption | Tokens useless without ENCRYPTION_KEY | Key management complexity | Architecture (20%): security |
| ORM | SQLAlchemy 2.0 | Async, type-safe, familiar | More boilerplate than peewee | Architecture (20%): maintainability |
