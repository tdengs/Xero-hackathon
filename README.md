# PayTrace AI

> **AI-powered reconciliation that explains every dollar between Stripe and Xero**

[![Build Status](https://img.shields.io/github/actions/workflow/status/paytrace-ai/paytrace/ci.yml?branch=main&style=flat-square&logo=github)](https://github.com/paytrace-ai/paytrace/actions)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue?style=flat-square&logo=python&logoColor=white)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Xero App](https://img.shields.io/badge/Xero-Connected-1AB4D7?style=flat-square&logo=xero&logoColor=white)](https://developer.xero.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Integrated-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/docs/api)
[![Claude AI](https://img.shields.io/badge/Claude-Anthropic-orange?style=flat-square)](https://www.anthropic.com/)

---

## The Problem

Every SaaS finance team has lived this exact scenario.

Your bank account shows a Stripe payout of **$8,742.63**. Your Xero dashboard shows expected revenue of **$9,102.00**. The difference is **$359.37** — and nobody knows where it went.

So your bookkeeper opens five tabs:

| Tab | Tool | What they're doing |
|-----|------|--------------------|
| 1 | Stripe Dashboard | Scrolling through 87 individual transactions |
| 2 | Stripe Payouts | Cross-referencing payout breakdown report |
| 3 | Xero Bank Feed | Matching the incoming bank transaction |
| 4 | Xero Invoices | Hunting for the corresponding invoices |
| 5 | Excel | Building a manual reconciliation spreadsheet |

Two hours later, they find it: Stripe fees ($214.37), three refunds ($96.00), a chargeback ($40.00), and an FX rounding adjustment ($9.00). Everything checks out. They manually create a journal entry, match the invoices, post the credit notes, and mark the bank transaction as reconciled.

**Then the next payout arrives. Repeat.**

### Why Existing Tools Fail

**Native Xero bank rules** match simple patterns but cannot decompose a Stripe payout into its constituent parts — fees, refunds, chargebacks, and FX adjustments are invisible to them.

**Stripe's Xero integration** syncs charges individually but creates reconciliation noise: dozens of tiny transactions instead of one clean payout with explanation.

**Manual reconciliation in Excel** is slow, error-prone, and produces no audit trail. When the auditor asks "why did you create this journal entry in December?", the answer is usually "I think I remember."

**Generic accounting automation** tools treat every bank transaction identically. They cannot understand the semantics of a Stripe payout — that gross sales minus fees minus refunds minus chargebacks equals the net deposit.

PayTrace AI is built specifically for this problem. It does not just match numbers. It explains them.

---

## The Solution — Explain, Verify, Execute

PayTrace AI works in three deterministic phases. Every payout goes through all three before a single write touches Xero.

### Phase 1: Explain

When a Stripe payout webhook arrives, PayTrace AI pulls the full transaction breakdown from the Stripe API and sends it to Claude with your historical reconciliation context. Claude returns a structured explanation in plain English — not accounting jargon, not a wall of numbers.

```
PayTrace AI Analysis - Stripe Payout $8,742.63 - Dec 15, 2024

This payout contains 87 customer payments ($9,102 gross), 3 refunds ($96),
1 chargeback ($40), Stripe fees ($214.37), FX adjustment ($9).

Reconciliation:
  Gross Sales:    $9,102.00
  Stripe Fees:     -$214.37
  Refunds:          -$96.00
  Chargeback:       -$40.00
  FX Adjustment:     -$9.00
  Net Payout:     $8,742.63 verified

ANOMALY: Refund rate is 3.2% (vs 1.6% average). Order 1821 was refunded 3 times.

Proposed Xero Actions:
  Match 87 invoices to payments
  Create journal: Stripe Fees $214.37 to Bank Charges (461)
  Create credit note: Refunds $96.00
  Reconcile bank transaction
```

The math is verified against your actual Stripe payout amount before Claude's explanation is shown. If the numbers do not balance to the cent, the system flags it for human review rather than proceeding.

### Phase 2: Verify

Before any action is taken, the proposed reconciliation plan is presented in the PayTrace AI dashboard. Each line item is shown with its source (Stripe API), its destination (Xero account code), and the Claude reasoning behind the categorisation.

You can:
- Approve the entire plan with one click
- Edit individual line items before approving
- Ask Claude follow-up questions ("Why was this categorised as Bank Charges instead of Payment Processing Fees?")
- Flag the payout for manual review with a note

Anomalies — like the triple refund on Order 1821 above — are surfaced with context, not buried in a report you read quarterly.

### Phase 3: Execute

Once approved, PayTrace AI executes all Xero writes atomically using idempotency keys derived from the Stripe payout ID. If anything fails mid-way (a network timeout, a Xero rate limit), the operation is rolled back cleanly and retried. Partial reconciliations never happen.

Every executed action is logged to an immutable audit trail: what changed, why Claude recommended it, who approved it, and when. The audit log is readable by your accountant, your auditor, and future you.

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              PayTrace AI Platform            │
                        │                                             │
   ┌──────────┐         │  ┌──────────────┐    ┌──────────────────┐  │
   │  Stripe  │─webhook─┼─►│  FastAPI     │    │   React 18 +     │  │
   │  Payouts │         │  │  Backend     │◄───│   TypeScript     │  │
   └──────────┘         │  │  :8000       │    │   Dashboard      │  │
                        │  └──────┬───────┘    └──────────────────┘  │
   ┌──────────┐         │         │                                   │
   │  Stripe  │◄────────┼─────────┤  Pull full                       │
   │  API     │         │         │  payout breakdown                 │
   └──────────┘         │         │                                   │
                        │  ┌──────▼───────┐                          │
                        │  │  PostgreSQL  │  Audit trail,            │
                        │  │  Database    │  reconciliation state,    │
                        │  └──────┬───────┘  token vault             │
                        │         │                                   │
                        │  ┌──────▼───────┐                          │
                        │  │   Redis      │  Task queue,             │
                        │  │   Cache      │  idempotency store,      │
                        │  └──────┬───────┘  rate limit buffer       │
                        │         │                                   │
                        │  ┌──────▼───────┐                          │
                        │  │  Claude AI   │  Payout explanation,     │
                        │  │  (Anthropic) │  anomaly detection,      │
                        │  └──────┬───────┘  account mapping         │
                        │         │                                   │
                        │  ┌──────▼───────┐                          │
                        │  │   Xero API   │  Invoice matching,       │
                        │  │  (OAuth 2.0) │  journal creation,       │
                        │  └─────────────┘  bank reconciliation      │
                        │                                             │
                        └─────────────────────────────────────────────┘

    Webhook → Decompose → Explain → Verify → Execute → Audit
```

**Data flow detail:**

1. Stripe fires a `payout.paid` webhook to the FastAPI endpoint
2. The webhook signature is verified (HMAC-SHA256 against your Stripe signing secret)
3. A background Celery task pulls the full payout transaction list from Stripe
4. The breakdown is passed to Claude with your account chart and reconciliation history as context
5. Claude returns a structured reconciliation plan with line-item reasoning
6. The plan is persisted to PostgreSQL and surfaced in the React dashboard
7. On approval, Xero writes are executed with SHA256-derived idempotency keys
8. All outcomes (success, partial failure, retry) are written to the immutable audit log
9. Slack notification (optional) confirms completion

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend Framework** | FastAPI 0.111 | Async API server, webhook handling, OAuth flows |
| **Database** | PostgreSQL 16 | Reconciliation state, audit trail, encrypted token storage |
| **Task Queue** | Celery + Redis | Async payout processing, retry queues, rate limit buffering |
| **Cache / State** | Redis 7 | Idempotency keys, session tokens, API response cache |
| **AI Engine** | Claude 3.5 Sonnet (Anthropic) | Payout explanation, anomaly detection, account mapping |
| **Frontend Framework** | React 18 + Vite | Dashboard, approval flows, audit log viewer |
| **Type Safety** | TypeScript 5.x | End-to-end type safety across frontend |
| **Styling** | Tailwind CSS 3.4 | Utility-first design system |
| **Payments Integration** | Stripe API v2024-11 | Payout data, transaction breakdown, webhook events |
| **Accounting Integration** | Xero API (OAuth 2.0) | Invoice matching, journal entries, bank reconciliation |
| **Token Encryption** | Cryptography (Fernet/AES-128) | Xero refresh tokens encrypted at rest |
| **Authentication** | JWT + OAuth 2.0 PKCE | User auth, Xero OAuth delegation |
| **Containerisation** | Docker + Docker Compose | Local development, production deployment |
| **Migrations** | Alembic | Database schema versioning |
| **Testing** | pytest + React Testing Library | Backend unit/integration, frontend component tests |
| **Linting** | Ruff (Python) + ESLint (TS) | Code quality enforcement |

---

## Quick Start with Docker

**Prerequisites:** Docker 24+, Docker Compose v2, a Stripe account, a Xero developer account, and an Anthropic API key.

```bash
# Clone the repository
git clone https://github.com/paytrace-ai/paytrace.git
cd paytrace

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your credentials (see variables below)

# Start all services
docker compose up --build

# In a separate terminal, run database migrations
docker compose exec backend alembic upgrade head

# The dashboard is now available at http://localhost:3000
# The API is available at http://localhost:8000
# API documentation at http://localhost:8000/docs
```

**Stripe webhook setup (local development):**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to your local server
stripe listen --forward-to localhost:8000/webhooks/stripe

# The CLI will print your webhook signing secret — add it to .env
```

### Environment Variables

Create `.env` from `.env.example`. All variables are required unless marked optional.

```bash
# ─── Application ──────────────────────────────────────────────────────────────
APP_ENV=development                         # development | staging | production
APP_SECRET_KEY=change-me-to-a-random-64-char-hex-string
APP_BASE_URL=http://localhost:8000          # Public URL (used for OAuth callbacks)
FRONTEND_URL=http://localhost:3000          # CORS origin for the React dashboard

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://paytrace:paytrace@db:5432/paytrace
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# ─── Anthropic / Claude ───────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...                # Get from https://console.anthropic.com
CLAUDE_MODEL=claude-sonnet-4-5              # Model to use for reconciliation
CLAUDE_MAX_TOKENS=4096                      # Max tokens per reconciliation response

# ─── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_PUBLISHABLE_KEY=pk_live_...          # Or pk_test_... for development
STRIPE_SECRET_KEY=sk_live_...              # Or sk_test_... for development
STRIPE_WEBHOOK_SECRET=whsec_...            # From `stripe listen` or Stripe Dashboard

# ─── Xero ─────────────────────────────────────────────────────────────────────
XERO_CLIENT_ID=your-xero-app-client-id     # From https://developer.xero.com/app/manage
XERO_CLIENT_SECRET=your-xero-client-secret
XERO_REDIRECT_URI=http://localhost:8000/auth/xero/callback
XERO_SCOPES=openid profile email accounting.transactions accounting.settings offline_access

# ─── Token Encryption ─────────────────────────────────────────────────────────
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
TOKEN_ENCRYPTION_KEY=your-fernet-key-here

# ─── Notifications (Optional) ─────────────────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...  # Optional: reconciliation alerts
SENTRY_DSN=https://...@sentry.io/...                    # Optional: error tracking

# ─── Rate Limiting ────────────────────────────────────────────────────────────
XERO_API_RATE_LIMIT_PER_MINUTE=60          # Xero allows 60 req/min per tenant
STRIPE_API_RATE_LIMIT_PER_SECOND=25        # Conservative default

# ─── Feature Flags ────────────────────────────────────────────────────────────
AUTO_APPROVE_BELOW_AMOUNT=0                # Auto-approve reconciliations under $X (0 = disabled)
ANOMALY_DETECTION_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=2555              # 7 years (standard accounting requirement)
```

---

## Project Structure

```
paytrace/
├── backend/                        # FastAPI application
│   ├── app/
│   │   ├── api/                    # Route handlers
│   │   │   ├── v1/
│   │   │   │   ├── auth.py         # OAuth flows (Xero, user login)
│   │   │   │   ├── payouts.py      # Payout list, detail, approval endpoints
│   │   │   │   ├── reconciliations.py  # Reconciliation CRUD and execution
│   │   │   │   ├── webhooks.py     # Stripe webhook receiver
│   │   │   │   └── audit.py        # Audit log query endpoints
│   │   │   └── deps.py             # FastAPI dependency injection
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings, env var loading
│   │   │   ├── security.py         # JWT, token encryption, HMAC verification
│   │   │   └── logging.py          # Structured JSON logging config
│   │   ├── models/
│   │   │   ├── payout.py           # SQLAlchemy ORM: Payout, PayoutTransaction
│   │   │   ├── reconciliation.py   # ReconciliationPlan, ReconciliationLine
│   │   │   ├── audit.py            # AuditEntry (append-only)
│   │   │   └── user.py             # User, XeroTenant, EncryptedToken
│   │   ├── schemas/
│   │   │   ├── payout.py           # Pydantic request/response schemas
│   │   │   ├── reconciliation.py   # Plan and approval schemas
│   │   │   └── xero.py             # Xero API response shapes
│   │   ├── services/
│   │   │   ├── stripe_service.py   # Stripe API client, payout decomposition
│   │   │   ├── xero_service.py     # Xero API client, OAuth token refresh
│   │   │   ├── claude_service.py   # Anthropic client, prompt engineering
│   │   │   ├── reconciliation_service.py  # Orchestrates explain→verify→execute
│   │   │   └── audit_service.py    # Immutable audit log writes
│   │   ├── tasks/
│   │   │   ├── celery_app.py       # Celery configuration
│   │   │   ├── process_payout.py   # Async payout processing task
│   │   │   └── xero_writer.py      # Atomic Xero write task with rollback
│   │   └── db/
│   │       ├── session.py          # Async SQLAlchemy session factory
│   │       └── migrations/         # Alembic migration scripts
│   │           └── versions/
│   ├── tests/
│   │   ├── unit/                   # Pure function tests (no I/O)
│   │   ├── integration/            # Tests against real Stripe/Xero sandboxes
│   │   └── fixtures/               # Stripe webhook payloads, Xero responses
│   ├── Dockerfile
│   ├── pyproject.toml              # Dependencies, tool config (Ruff, pytest)
│   └── alembic.ini
│
├── frontend/                       # React 18 + TypeScript dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── PayoutList/         # Payout queue with status indicators
│   │   │   ├── ReconciliationCard/ # Expandable payout detail + AI explanation
│   │   │   ├── ApprovalFlow/       # Line-item review and one-click approval
│   │   │   ├── AnomalyBanner/      # Surfaced anomalies with context
│   │   │   ├── AuditLog/           # Filterable, searchable audit trail
│   │   │   └── XeroConnect/        # OAuth connection management
│   │   ├── hooks/
│   │   │   ├── usePayouts.ts       # SWR data fetching for payout queue
│   │   │   ├── useReconciliation.ts # Reconciliation state and approval actions
│   │   │   └── useXeroStatus.ts    # Xero connection health
│   │   ├── lib/
│   │   │   ├── api.ts              # Typed API client (fetch wrapper)
│   │   │   └── formatters.ts       # Currency, date, percentage formatters
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Main payout queue view
│   │   │   ├── PayoutDetail.tsx    # Full reconciliation review page
│   │   │   ├── AuditLog.tsx        # Audit trail browser
│   │   │   └── Settings.tsx        # Xero tenant, account mappings, preferences
│   │   ├── types/
│   │   │   └── api.ts              # Generated TypeScript types matching backend schemas
│   │   └── App.tsx
│   ├── public/
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── docker-compose.yml              # Full local stack (backend, frontend, db, redis)
├── docker-compose.prod.yml         # Production overrides (no volumes, health checks)
├── .env.example                    # All required variables with descriptions
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, test, type-check on every PR
│       └── deploy.yml              # Deploy to staging on merge to main
├── docs/
│   ├── architecture.md             # ADR and system design decisions
│   ├── xero-account-mapping.md     # Default account code mappings
│   └── stripe-event-types.md       # Supported Stripe payout event types
└── README.md                       # This file
```

---

## API Reference

All endpoints are prefixed `/api/v1`. The full interactive docs are at `/docs` (Swagger UI) and `/redoc`.

### Authentication

```http
GET /api/v1/auth/xero
```
Redirects to Xero OAuth 2.0 authorization. No request body required.

```http
GET /api/v1/auth/xero/callback?code={code}&state={state}
```
Xero OAuth callback. Exchanges code for tokens, encrypts and stores refresh token.

---

### Payouts

**List payouts with reconciliation status:**

```http
GET /api/v1/payouts?status=pending&limit=20&offset=0
Authorization: Bearer {jwt}
```

```json
{
  "items": [
    {
      "id": "po_3QGhX2LkdIwHu7ix0OctNqkA",
      "stripe_payout_id": "po_3QGhX2LkdIwHu7ix0OctNqkA",
      "amount": 874263,
      "currency": "usd",
      "arrival_date": "2024-12-15",
      "status": "pending_review",
      "reconciliation_plan_id": "rec_01JKPQ8X...",
      "anomalies": [
        {
          "type": "elevated_refund_rate",
          "description": "Refund rate is 3.2% vs 1.6% average",
          "severity": "warning"
        }
      ],
      "created_at": "2024-12-15T18:23:41Z"
    }
  ],
  "total": 12,
  "has_more": true
}
```

**Get payout with full AI explanation:**

```http
GET /api/v1/payouts/{payout_id}
Authorization: Bearer {jwt}
```

```json
{
  "id": "po_3QGhX2LkdIwHu7ix0OctNqkA",
  "amount": 874263,
  "breakdown": {
    "gross_sales": 910200,
    "stripe_fees": -21437,
    "refunds": -9600,
    "chargebacks": -4000,
    "fx_adjustment": -900,
    "net_payout": 874263,
    "verified": true
  },
  "claude_explanation": "This payout contains 87 customer payments...",
  "reconciliation_plan": {
    "id": "rec_01JKPQ8X...",
    "lines": [
      {
        "action": "match_invoices",
        "description": "Match 87 invoices to payment",
        "amount": 910200,
        "xero_account_code": null,
        "confidence": 0.97
      },
      {
        "action": "create_journal",
        "description": "Stripe processing fees",
        "amount": 21437,
        "xero_account_code": "461",
        "xero_account_name": "Bank Charges",
        "confidence": 0.99
      },
      {
        "action": "create_credit_note",
        "description": "Customer refunds (3)",
        "amount": 9600,
        "xero_account_code": "200",
        "confidence": 0.94
      }
    ]
  }
}
```

---

### Reconciliation

**Approve a reconciliation plan:**

```http
POST /api/v1/reconciliations/{plan_id}/approve
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "approved_lines": ["line_01", "line_02", "line_03"],
  "override_lines": [
    {
      "line_id": "line_02",
      "xero_account_code": "404",
      "override_reason": "Internal policy: use Merchant Fees account"
    }
  ]
}
```

```json
{
  "id": "rec_01JKPQ8X...",
  "status": "executing",
  "execution_id": "exec_01JKPR2Y...",
  "message": "Reconciliation queued. You will be notified on completion."
}
```

**Check execution status:**

```http
GET /api/v1/reconciliations/{plan_id}/execution
Authorization: Bearer {jwt}
```

```json
{
  "execution_id": "exec_01JKPR2Y...",
  "status": "completed",
  "completed_at": "2024-12-15T18:31:07Z",
  "xero_actions": [
    {
      "action": "match_invoices",
      "status": "success",
      "xero_reference": "INV-0087",
      "idempotency_key": "sha256:3f2a9c..."
    },
    {
      "action": "create_journal",
      "status": "success",
      "xero_reference": "JNL-0342",
      "idempotency_key": "sha256:8d4e1b..."
    }
  ]
}
```

---

### Webhooks

**Stripe webhook receiver:**

```http
POST /webhooks/stripe
Stripe-Signature: t=1702665821,v1=abc123...
Content-Type: application/json

{
  "type": "payout.paid",
  "data": {
    "object": { "id": "po_3QGhX2LkdIwHu7ix0OctNqkA", ... }
  }
}
```

Responds `200 OK` immediately. Processing is async. Signature is verified before any work begins.

---

### Audit Log

**Query the audit trail:**

```http
GET /api/v1/audit?payout_id={id}&from=2024-12-01&to=2024-12-31&limit=50
Authorization: Bearer {jwt}
```

```json
{
  "entries": [
    {
      "id": "aud_01JKPS9Z...",
      "timestamp": "2024-12-15T18:31:07Z",
      "actor": "user:usr_01JK...",
      "action": "reconciliation.approved",
      "entity_type": "reconciliation_plan",
      "entity_id": "rec_01JKPQ8X...",
      "details": {
        "payout_id": "po_3QGhX2LkdIwHu7ix0OctNqkA",
        "amount": 874263,
        "lines_approved": 4,
        "lines_overridden": 1
      },
      "claude_reasoning": "Fees mapped to Bank Charges (461) based on your historical preference across 43 prior payouts."
    }
  ]
}
```

---

## Judging Criteria Alignment

| Feature | Xero Connection (50%) | API Integration (30%) | Architecture (20%) |
|---------|----------------------|----------------------|-------------------|
| **Payout decomposition** | Writes journals, credit notes, and invoice matches directly to Xero via official API | Calls Stripe Balance Transactions API to break down each payout to the cent | Async Celery task prevents webhook timeout; Redis buffers against Xero rate limits |
| **OAuth 2.0 + PKCE** | Full Xero OAuth flow with offline_access scope for unattended reconciliation | Stripe webhook HMAC-SHA256 verification on every event | Fernet-encrypted refresh tokens stored in PostgreSQL; never in environment variables post-setup |
| **AI explanation engine** | Account code suggestions drawn from user's actual Xero chart of accounts | Claude receives Stripe API response as structured context, not free text | Deterministic prompt template with structured output parsing; no free-form JSON risks |
| **Idempotent Xero writes** | All Xero creates use SHA256(payout_id + line_type) as idempotency key | Stripe payout ID is the canonical deduplication key across both APIs | Idempotency keys stored in Redis with TTL; database constraint prevents double-write |
| **Anomaly detection** | Anomalies surfaced before Xero writes, not discovered after | Refund rate, chargeback frequency, and FX exposure computed from Stripe transaction data | Claude compares current payout metrics against rolling average stored in PostgreSQL |
| **Immutable audit trail** | Every Xero API call (success or failure) logged with payload and response | Every Stripe API call logged with request ID for cross-reference | Audit table has no UPDATE or DELETE permissions; append-only enforced at DB level |
| **Retry with rollback** | Failed Xero writes are rolled back before retry to prevent partial reconciliation | Stripe API failures trigger exponential backoff with jitter (max 5 attempts) | Celery task state machine: pending → executing → completed / failed / rolled_back |
| **Multi-tenant architecture** | Each Xero tenant has isolated token storage and separate account mapping config | Stripe webhook events are routed to the correct tenant via metadata on the payout | PostgreSQL row-level security ensures tenant data isolation at the database layer |
| **Human-in-the-loop approval** | No Xero write occurs without explicit user approval (configurable threshold) | Stripe payout details fetched fresh at approval time to prevent stale data | Approval state stored in Redis with 24-hour expiry; stale approvals require re-fetch |
| **Real-time dashboard** | Xero reconciliation status reflected in dashboard within seconds of completion | Stripe webhook triggers immediate UI update via server-sent events | FastAPI SSE endpoint pushes status changes; no polling required |

---

## Production Readiness

### Idempotency

Every write to Xero is protected by an idempotency key constructed as:

```python
key = sha256(f"{stripe_payout_id}:{line_type}:{xero_tenant_id}".encode()).hexdigest()
```

This key is stored in Redis before the Xero API call is made and checked before any retry. If Xero returns a `200` on a retry (indicating the write succeeded on a previous attempt), the response is treated as a success. Duplicate bank transactions, duplicate journals, and duplicate credit notes are structurally impossible.

### Audit Trail

Every decision made by the system — including Claude's reasoning — is written to the `audit_entries` table before any external API call. The schema is:

```sql
CREATE TABLE audit_entries (
    id          TEXT PRIMARY KEY,           -- ULID
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor       TEXT NOT NULL,              -- user:{id} or system:paytrace
    action      TEXT NOT NULL,              -- dot-separated verb (e.g. reconciliation.approved)
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    details     JSONB NOT NULL,
    claude_reasoning TEXT,                  -- Raw Claude explanation for this decision
    stripe_request_id TEXT,                 -- For cross-referencing with Stripe support
    xero_request_id TEXT                    -- For cross-referencing with Xero support
);

-- No UPDATE, no DELETE. Enforced by application-level constraint and DB user permissions.
REVOKE UPDATE, DELETE ON audit_entries FROM paytrace_app;
```

Audit entries are retained for 7 years by default (configurable via `AUDIT_LOG_RETENTION_DAYS`).

### Token Encryption

Xero OAuth refresh tokens are encrypted with Fernet (AES-128-CBC + HMAC-SHA256) before storage:

```python
from cryptography.fernet import Fernet

cipher = Fernet(settings.TOKEN_ENCRYPTION_KEY)
encrypted = cipher.encrypt(refresh_token.encode())
# stored in database as encrypted bytes
# decrypted in-memory only when a Xero API call is made
```

The encryption key is never stored in the database. It exists only in the environment. If the database is compromised, OAuth tokens cannot be recovered without the encryption key.

### Retry Strategy

All external API calls use exponential backoff with full jitter:

```python
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential_jitter(initial=1, max=60),
    retry=retry_if_exception_type((RateLimitError, NetworkError)),
    before_sleep=log_retry_attempt,
)
async def call_xero_api(endpoint: str, payload: dict) -> dict:
    ...
```

Xero `429 Too Many Requests` responses are caught and the retry is scheduled after the `Retry-After` header value if present, falling back to the exponential calculation.

### Webhook Verification

Stripe webhooks are verified before any processing begins:

```python
def verify_stripe_webhook(payload: bytes, signature: str, secret: str) -> dict:
    try:
        event = stripe.Webhook.construct_event(payload, signature, secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    return event
```

Replay attacks are mitigated by Stripe's 5-minute timestamp tolerance. The `stripe_event_id` is stored with a unique constraint to prevent processing the same event twice even within the tolerance window.

---

## Bounty Track

### Primary: Bounty 02 — The Vibe Integrator

PayTrace AI is purpose-built for Bounty 02. The judging criteria maps directly to core system capabilities:

**Xero Connection (50% weight):** PayTrace AI does not use Xero as a data store — it uses Xero as the source of truth for account structure and the authoritative ledger for reconciliation outcomes. The integration spans `accounting.transactions` (invoice matching, journal creation, credit notes, bank reconciliation) and `accounting.settings` (chart of accounts for Claude's account mapping context). Every Xero write uses the official API with proper OAuth scopes, idempotency keys, and retry handling. This is not a demo integration.

**API Integration (30% weight):** The Stripe integration goes beyond reading payout amounts. PayTrace AI calls `balance_transactions.list` with the payout as a filter to decompose every dollar: individual charges, refunds, disputes, fee objects, and currency conversion adjustments. This raw data is structured and passed to Claude, which then proposes the exact Xero journal entries that will make the books balance. The two APIs — Stripe and Xero — are connected through AI that understands accounting semantics, not just data mapping.

**Architecture (20% weight):** Webhook-driven, async, multi-tenant, with encrypted token storage, an immutable audit trail, and idempotent writes. The system can process concurrent payouts without race conditions. A production-grade Celery task queue with Redis backing handles the async processing pipeline. The FastAPI backend is fully type-annotated with Pydantic v2 models.

### Secondary: Bounty 01 — Productivity Powerhouse

Reconciling a single Stripe payout manually takes 1-3 hours depending on volume and complexity. PayTrace AI reduces this to under 5 minutes — explanation is instant, approval is a single click, execution is automated. For teams processing 20+ payouts per month, this represents 20-60 hours of recovered bookkeeper time per month.

The anomaly detection layer adds a productivity multiplier: instead of discovering a suspicious refund pattern during a quarterly audit, your team sees it before they approve the payout. Problems surface at the moment of maximum actionability.

### Tertiary: Bounty 03 — Cash Flow Accelerator

Reconciliation delays are cash flow risk. When payouts sit unreconciled, your Xero balance is wrong. Decisions about payroll, vendor payments, and investment are made against incorrect numbers. PayTrace AI reconciles each payout within minutes of arrival, keeping Xero current and giving finance teams accurate real-time visibility.

The anomaly detection layer also surfaces early signals of chargeback clusters, elevated refund rates, and FX exposure — information that has direct cash flow implications.

---

## Roadmap

### Q1 2025 — MVP (Current)
- Stripe payout webhook processing
- Claude-powered payout explanation and decomposition
- Xero OAuth 2.0 integration with encrypted token storage
- Invoice matching, journal entry creation, credit note posting
- Human-in-the-loop approval dashboard
- Anomaly detection (refund rate, chargeback frequency)
- Immutable audit trail
- Docker Compose deployment

### Q2 2025 — Platform Expansion
- **Shopify Payments** payout support (Shopify Payouts API)
- **PayPal** payout decomposition
- **Stripe Connect** multi-account support for platforms
- Bulk payout approval for trusted low-risk payouts below configurable threshold
- Slack and email notifications with one-click approve links
- CSV export of reconciliation history for accountants
- Xero Practice Manager integration for accounting firm workflows

### Q3 2025 — Month-End Close Automation
- Month-end close checklist: outstanding payouts, unmatched invoices, pending credit notes
- Prepaid expense amortisation schedules with Xero journal automation
- FX gain/loss journal automation for multi-currency organisations
- AR aging report with AI commentary on overdue patterns
- Cash flow forecast powered by reconciled Stripe revenue data
- API for third-party accounting tools to pull reconciliation status

### Q4 2025 — Xero App Store Launch
- Xero App Store listing and certification process
- Subscription billing via Stripe (ironic, but fitting)
- SOC 2 Type I audit preparation
- Self-hosted deployment guide for organisations with data residency requirements
- White-label option for accounting firms
- Support for Xero's global regions (AU, NZ, UK, US, CA)

---

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening a pull request.

**Development setup (without Docker):**

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

**Running tests:**

```bash
# Backend unit tests
cd backend && pytest tests/unit -v

# Backend integration tests (requires .env with test credentials)
cd backend && pytest tests/integration -v --tb=short

# Frontend tests
cd frontend && npm test
```

**Code quality:**

```bash
# Backend
cd backend && ruff check . && ruff format --check .

# Frontend
cd frontend && npm run lint && npm run type-check
```

---

## License

MIT License

Copyright (c) 2025 PayTrace AI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

<p align="center">
  Built for the Xero App Hackathon &mdash; Bounty 02: The Vibe Integrator
  <br>
  <a href="https://developer.xero.com/">Xero Developer</a> &bull;
  <a href="https://stripe.com/docs/api">Stripe API</a> &bull;
  <a href="https://www.anthropic.com/">Anthropic Claude</a>
</p>
