# PayTrace AI — Product Requirements Document

## 1. Executive Summary

Small businesses using Xero to manage their accounting face a persistent, painful problem: the money that hits their bank account from Stripe never matches the revenue their ecommerce platform reports. A Stripe payout of $8,742.63 arrives, but Shopify shows $9,102.00 in weekend sales. The $359.37 difference is real — Stripe fees, refunds, a chargeback, and an FX adjustment — but explaining it requires opening five different tools and spending 45 minutes piecing together a puzzle that no single platform can solve.

PayTrace AI is an explainable AI reconciliation agent that reasons across Xero, Stripe, and bank feeds simultaneously. It answers "where did the money go?" in under 8 seconds, provides evidence for every claim, and reconciles the transaction in Xero with a single click. This directly addresses the 50% Xero Connection judging criterion: we don't just read from Xero, we write audit-proof journal entries, match invoices to payments, and reconcile bank transactions — the accounting work that currently takes hours.

---

## 2. Problem Statement

### 2.1 The Reconciliation Gap

Every ecommerce business using Xero + Stripe experiences this weekly:

| Data Point | Source | Amount |
|---|---|---|
| Weekend sales revenue | Shopify | $9,102.00 |
| Bank deposit (Monday) | Bank feed / Xero | $8,742.63 |
| **Unexplained gap** | **Unknown** | **$359.37** |

Where the $359.37 goes:
- **Stripe processing fees**: $214.37 (2.9% + $0.30 × 87 transactions)
- **Refunds**: $96.00 (3 refund events — including Order #1821 refunded 3 times)
- **Chargeback**: $40.00 (1 dispute filed Dec 12, not yet visible in Shopify)
- **FX adjustment**: $9.00 (AUD/USD conversion variance)

None of these line items live in one place. Stripe knows its fees but not the Xero invoices. Xero knows the invoices but not the payout breakdown. No single tool sees the full picture.

### 2.2 The Current 5-Tab Workflow

A bookkeeper reconciling a single Stripe payout today:

1. **Login to Stripe** → navigate to Payouts → find the correct payout → download CSV
2. **Login to Shopify** → find orders for that date range → export to CSV
3. **Open Xero** → go to Bank Reconciliation → try to match $8,742.63 against open invoices
4. **Open a spreadsheet** → manually calculate: gross - fees - refunds - chargebacks = net
5. **Check bank statement** → verify the numbers match

**Total time**: 45 minutes per payout  
**Payouts per month**: 12–30 (daily or weekly Stripe payouts)  
**Total monthly burden**: 9–22 hours per business, per month

### 2.3 Quantified Pain

- **4.4 million** Xero users globally
- **~60%** use a payment processor (Stripe, PayPal, Square, Shopify Payments)
- **2.6 million** businesses affected
- **15+ hours/month** average reconciliation time per business
- **8–15%** manual reconciliation error rate (industry studies)
- **$750–$1,200/month** in wasted bookkeeper labor per client (at $50–80/hr)

---

## 3. Target Personas

### Persona 1: Sarah the Bookkeeper

| Attribute | Detail |
|---|---|
| Age | 35 |
| Role | Bookkeeper managing 12 Xero clients |
| Pain | 3 hrs/client/month on reconciliation = 36 hrs/month wasted |
| Goal | Close books in half the time without errors |
| Key frustration | "I switch between Stripe, Xero, and Shopify for every single payout" |
| How PayTrace helps | AI does the matching and journal entries; Sarah reviews and approves |
| Success metric | Cut reconciliation from 3 hours to 20 minutes per client per month |

### Persona 2: Marcus the Founder

| Attribute | Detail |
|---|---|
| Age | 42 |
| Role | Founder of TechGear NZ, $2M ARR ecommerce on Shopify + Stripe |
| Pain | Cannot understand why bank balance never matches Shopify revenue |
| Goal | Understand business finances without becoming an accountant |
| Key question | "Why is my cash $20k lower than my revenue dashboard?" |
| How PayTrace helps | Plain-English AI explanations — no accounting knowledge required |
| Success metric | Can answer cash vs revenue question in under 2 minutes, independently |

### Persona 3: Priya the Accountant

| Attribute | Detail |
|---|---|
| Age | 29 |
| Role | Chartered accountant handling month-end close for 5 companies |
| Pain | Manual journal entries for fees/refunds are error-prone and tedious |
| Goal | Audit-proof reconciliation she can sign off on with confidence |
| Key concern | "If the AI makes a mistake in Xero, it creates work to unwind" |
| How PayTrace helps | Every AI action has complete evidence trail + reasoning log |
| Success metric | Zero reconciliation errors, full audit trail per regulatory requirement |

---

## 4. User Journey Maps

### 4.1 Current Journey: Reconciling a Stripe Payout (Before PayTrace)

```
Monday morning. Bank feed in Xero shows:
  "Stripe Payout · Dec 15 · $8,742.63 · Unreconciled"

Step 1: Open Stripe (Tab 1)
  → Navigate to Payouts → Find Dec 15 payout
  → Download "Balance transactions" CSV
  Time: 5 min

Step 2: Open Shopify (Tab 2)
  → Find orders between Dec 13–15
  → Export order list
  Time: 5 min

Step 3: Open Xero (Tab 3)
  → Go to Accounts Receivable → find invoices for that period
  → Try to match $8,742.63 against 87 invoices manually
  Time: 15 min

Step 4: Open spreadsheet (Tab 4)
  → Calculate: $9,102 - $214.37 - $96 - $40 - $9 = $8,742.63
  → Discover the chargeback that didn't show in Shopify
  Time: 10 min

Step 5: Return to Xero
  → Create manual journal for Stripe fees
  → Create credit note for refunds
  → Mark bank transaction as reconciled
  Time: 10 min

Total: 45 minutes. Confidence: ~85%.
```

### 4.2 Future Journey: With PayTrace AI (After)

```
Monday morning. Bank feed shows:
  "Stripe Payout · Dec 15 · $8,742.63 · ⚡ Needs Reconciliation · [✨ Explain with AI]"

Step 1: Click "✨ Explain with AI"
  → PayTrace fetches Stripe transactions, cross-references Xero invoices
  → AI reasons across 87 transactions in 8 seconds

Step 2: Review AI explanation (30 sec)
  → Plain-English summary: "87 payments, 3 refunds, 1 chargeback, Stripe fees"
  → Breakdown table: $9,102 - $214.37 - $96 - $40 - $9 = $8,742.63 ✓
  → Anomaly alert: "Refund rate 3.2% — double the 1.6% average. Order #1821 refunded 3×"

Step 3: Click evidence on any line (10 sec)
  → Stripe fee row expands: "87 fee transactions totalling $214.37 — SOURCE: Stripe API"

Step 4: Click "Reconcile Everything" → Confirm (30 sec)
  → AI creates: fee journal, refund credit note, invoice matches, bank reconciliation

Total: under 2 minutes. Confidence: 99.5%.
```

---

## 5. Core Features (MoSCoW)

### Must Have (MVP)

| ID | Feature | Description |
|---|---|---|
| F1 | Xero OAuth 2.0 | Securely connect user's Xero organisation |
| F2 | Stripe OAuth | Securely connect user's Stripe account |
| F3 | Bank feed sync | Fetch unreconciled bank transactions from Xero API |
| F4 | Stripe payout sync | Fetch all balance transactions behind a payout (paginated) |
| F5 | AI Explain Payout | Claude agent explains every dollar using Explain→Verify→Execute |
| F6 | Evidence Viewer | Every AI claim linked to source transaction ID with external link |
| F7 | One-Click Execute | Creates Xero journal entries + reconciles bank transaction |
| F8 | Audit Trail | Every AI action logged with reasoning, user approval, and timestamp |
| F9 | Natural language chat | "Anything unusual this week?" — conversational accounting Q&A |

### Should Have (Next Sprint)

| ID | Feature | Description |
|---|---|---|
| F10 | Anomaly detection | Automated alerts for refund spikes, chargebacks, FX variance |
| F11 | Shopify integration | Match Stripe charges to specific Shopify orders |
| F12 | PayPal integration | Extend reconciliation to PayPal payouts |

### Could Have (Future)

| ID | Feature | Description |
|---|---|---|
| F13 | Cash flow forecasting | "How much cash will I have in 30 days?" |
| F14 | Month-end close assistant | Walk through full close checklist with AI |
| F15 | Multi-currency FX | Detailed FX gain/loss explanation |

### Won't Have (MVP)

Payroll integration, tax filing, multi-entity Xero orgs, mobile app.

---

## 6. Xero Integration Points

This is the foundation of our 50% Xero Connection score.

| Xero API Endpoint | HTTP | PayTrace Usage | Accounting Impact |
|---|---|---|---|
| `/BankTransactions` | GET | Fetch bank feed showing unreconciled Stripe deposits | Core data source |
| `/Invoices` | GET | Search invoices by amount/date to match Stripe payments | Closes invoice loop |
| `/Payments` | POST | Mark invoice as paid with Stripe charge as reference | Full AR reconciliation |
| `/ManualJournals` | POST | Create expense entries for Stripe fees, refunds | Automates bookkeeping |
| `/BankTransactions/{id}` | PUT | Mark bank transaction as reconciled | Final reconciliation |
| `/Accounts` | GET | Fetch chart of accounts for correct journal coding | Proper categorization |

**Why this wins the Xero criterion**: We don't just read from Xero — we write meaningful accounting entries that a qualified accountant would produce, with full evidence attached. The AI understands accounting (double-entry, account codes, journal narrations) not just data retrieval.

---

## 7. API Integration Points

This addresses the 30% API Integration score.

| API | Integration Type | What We Extract |
|---|---|---|
| Xero Accounting API | OAuth 2.0 + REST | Bank transactions, invoices, journal entries, accounts |
| Stripe API | OAuth + REST | Payouts, balance transactions, charges, refunds, disputes |
| Stripe Webhooks | HMAC-verified webhooks | Real-time payout.paid, charge.refunded, dispute.created events |

---

## 8. Success Metrics

| Metric | Baseline (Manual) | Target (PayTrace) |
|---|---|---|
| Time to reconcile per payout | 45 minutes | Under 2 minutes (95% reduction) |
| Reconciliation accuracy | ~90% (manual errors) | >99.5% |
| Anomaly detection rate | 0% automated | >80% recall |
| User weekly retention at day 30 | N/A | >70% |
| Xero write error rate | 8–15% | 0% (idempotency keys) |
| Audit trail completeness | 0% | 100% (every action logged) |

---

## 9. Non-Functional Requirements

**Idempotency**: All Xero write operations use SHA256-hashed idempotency keys derived from `payout_id + action_type + "v1"`. Double-clicking Reconcile cannot create duplicate journal entries.

**Audit**: Every user action and every AI action is written to `audit_logs` with `user_id`, `action`, `entity_type`, `entity_id`, `before_state`, `after_state`, `agent_job_id`, and `timestamp`. Write-only — never updated.

**Reliability**: Exponential backoff retry (1s → 2s → 4s → 8s → max 60s) with jitter on all Stripe and Xero API calls. Max 3 attempts. Circuit breaker after 5 consecutive failures.

**Performance**: AI explanation completes in under 15 seconds for payouts with up to 500 transactions.

**Security**: OAuth tokens encrypted at rest with Fernet (AES-128-CBC). HTTPS only. Stripe webhook signature verification (HMAC-SHA256).

**Availability**: 99.9% uptime target.

---

## 10. Roadmap

| Milestone | Timeline | Key Deliverable |
|---|---|---|
| MVP | Month 1 | Stripe × Xero reconciliation, AI explain, evidence viewer, one-click execute |
| Shopify + PayPal | Month 2 | Order-level matching, PayPal payout sync |
| Anomaly Alerts | Month 3 | Refund rate monitoring, chargeback alerts, email notifications |
| Month-End Close | Month 6 | AI-guided close checklist, Xero App Store listing |
| Forecasting | Month 12 | Cash flow forecasting, fraud detection, multi-currency |
