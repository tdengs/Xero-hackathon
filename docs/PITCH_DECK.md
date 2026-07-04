# PayTrace AI — Pitch Deck
### 10 Slides | Hackathon Submission

---

## SLIDE 1 — THE HOOK

**Visual Description:**
Split screen. Left side: a bank statement with a single bold number — **$8,742.63** — highlighted in blue. Right side: a Shopify dashboard showing **$9,102.00** in green. In the center, a bold red question mark with the text:

> **"Where is the $359.37?"**

Below both panels, a faint digital clock ticking upward: **0:00 … 0:05 … 0:45:00**

---

**Key Message:**
Every small business owner has felt this moment. The numbers don't match, and finding out why costs nearly an hour of their day — every single week.

---

**Speaker Notes:**
"Raise your hand if you run a business that takes online payments. Now keep your hand up if your bank balance has ever not matched what you expected after a Stripe or Shopify payout. That gap — sometimes a few dollars, sometimes a few hundred — is not a mystery. But solving it costs you 45 minutes, five browser tabs, and a low-grade anxiety that never fully goes away. We built PayTrace AI to end that."

---
---

## SLIDE 2 — THE PROBLEM

**Visual Description:**
A horizontal timeline of five browser tab icons, each representing one step in the current workflow. Beneath each tab: a time estimate and a pain point label.

```
[Stripe CSV]    [Shopify Export]    [Xero Entry]    [Spreadsheet]    [Bank PDF]
  Download         Export Data        Manual Paste     VLOOKUP Match    Cross-check
  ~8 min           ~6 min             ~12 min          ~10 min          ~9 min

                        TOTAL: ~45 MINUTES. EVERY SINGLE WEEK.
                    And at the end? You're still not 100% certain.
```

A small red label at the bottom: **"Error-prone. Time-consuming. Unsatisfying."**

---

**Key Message:**
The current workflow is a patchwork of manual steps across incompatible tools. It is slow, fragile, and breeds doubt — not confidence.

---

**Speaker Notes:**
"Here is what a typical week looks like for Marcus — a Shopify store owner with 200 orders a month. He downloads his Stripe payout CSV. He exports Shopify order data. He manually enters figures into Xero. He runs VLOOKUP formulas in Excel. He cross-references the bank PDF. Forty-five minutes later, he closes his laptop hoping the numbers are right. Hoping. That word should not exist in accounting. We replace 'hoping' with 'knowing.'"

---
---

## SLIDE 3 — WHY EXISTING TOOLS FAIL

**Visual Description:**
Three columns, each representing a major tool. Each column shows what the tool KNOWS and what it CANNOT SEE.

```
+------------------+  +------------------+  +------------------+
|    STRIPE        |  |      XERO        |  |    SHOPIFY       |
|                  |  |                  |  |                  |
|  KNOWS:          |  |  KNOWS:          |  |  KNOWS:          |
|  - Fees          |  |  - Invoices      |  |  - Orders        |
|  - Payouts       |  |  - Journal       |  |  - Refunds       |
|  - Chargebacks   |  |    Entries       |  |  - Products      |
|  - FX rates      |  |  - Bank feeds    |  |                  |
|                  |  |                  |  |                  |
|  CANNOT SEE:     |  |  CANNOT SEE:     |  |  CANNOT SEE:     |
|  - Your invoices |  |  - Payout        |  |  - Payment       |
|  - Order context |  |    breakdown     |  |    timing        |
|  - Refund reason |  |  - Fee logic     |  |  - Fee deduction |
+------------------+  +------------------+  +------------------+

              NO SINGLE TOOL SEES THE FULL PICTURE.
```

---

**Key Message:**
The problem is not that the tools are bad. It is that they were built in isolation. No tool holds the complete financial truth of your business — until now.

---

**Speaker Notes:**
"Stripe is excellent at payment processing. Xero is world-class at accounting. Shopify is brilliant at commerce. But they speak different languages. Stripe knows your fees but has no idea what invoice they relate to. Xero knows your invoices but cannot decompose a Stripe payout. Shopify knows every order but has no concept of payment timing or net settlement. The gap between these systems is where 45 minutes goes to die — every week. PayTrace AI sits in the middle and speaks all three languages simultaneously."

---
---

## SLIDE 4 — THE SOLUTION: PAYTRACE AI

**Visual Description:**
A clean three-panel framework card with a central logo mark.

```
+-----------------------------------------------------------+
|                                                           |
|    EXPLAIN          VERIFY           EXECUTE              |
|                                                           |
|  "Why does my    "Is every number   "Update Xero.        |
|   bank show      linked to real     Reconcile the        |
|   $8,742?"       data?"             bank feed."          |
|                                                           |
|  AI reasons      Evidence for       Human approves.      |
|  across all      every claim.       System executes.     |
|  your data.      No black boxes.    Full audit trail.    |
|                                                           |
+-----------------------------------------------------------+

         "We do not replace the accountant.
          We give them superpowers."
```

Sub-label at bottom: **Human-in-the-loop by design. AI does the thinking. You make the call.**

---

**Key Message:**
PayTrace AI does not automate blindly. It reasons transparently, surfaces evidence, and waits for human approval before touching anything in Xero.

---

**Speaker Notes:**
"We make three promises. First: Explain. Ask PayTrace AI why any payout is what it is, and you get a complete, plain-English breakdown with every number accounted for. Second: Verify. Every figure traces back to a real Stripe transaction or Xero record — no black boxes, no guessing. Third: Execute. When you are satisfied, click once. Xero updates. The bank feed reconciles. An audit trail is written. Our philosophy is simple: the AI does the forensic accounting. The human makes the decision. This is not about replacing accountants — it is about making them ten times more effective."

---
---

## SLIDE 5 — ARCHITECTURE

**Visual Description:**
A clean ASCII system diagram showing every component and how they connect.

```
                        PAYTRACE AI — SYSTEM ARCHITECTURE

  ┌─────────────────────────────────────────────────────────────┐
  │                     REACT FRONTEND                          │
  │   Dashboard | Payout Explainer | Reconcile UI | Audit Log   │
  └───────────────────────┬─────────────────────────────────────┘
                          │ REST API / WebSocket
  ┌───────────────────────▼─────────────────────────────────────┐
  │                   FASTAPI BACKEND                           │
  │   OAuth Mgr | Agent Router | Idempotency Layer | Rate Limiter│
  └──────┬──────────────┬─────────────────┬────────────────────┘
         │              │                 │
  ┌──────▼──────┐ ┌─────▼──────┐ ┌───────▼──────┐
  │ PostgreSQL  │ │   REDIS    │ │  CLAUDE AI   │
  │ - Users     │ │ - Sessions │ │  AGENT       │
  │ - Audit Log │ │ - Job Queue│ │  - Reasoning │
  │ - Mappings  │ │ - Cache    │ │  - Evidence  │
  └─────────────┘ └────────────┘ └───────┬──────┘
                                         │
               ┌─────────────────────────┼──────────────┐
               │                         │              │
       ┌───────▼───────┐         ┌───────▼──────┐       │
       │  XERO API     │         │  STRIPE API  │       │
       │  OAuth 2.0    │         │  REST + CSV  │       │
       │  6 Endpoints  │         │  Webhooks    │       │
       └───────────────┘         └──────────────┘       │
                                               ┌─────────▼────┐
                                               │ SHOPIFY API  │
                                               │ (coming Q2)  │
                                               └──────────────┘

   Built for production: OAuth 2.0 | Audit Trails | Idempotency | Rate Limiting
```

---

**Key Message:**
This is not a hackathon toy. It is a production-grade architecture with proper security, resilience, and a clear path to scale.

---

**Speaker Notes:**
"Let me show you what is under the hood. The frontend is React — clean, responsive, real-time. The backend is FastAPI — fast, typed, async. We use PostgreSQL for persistent state and audit logs, Redis for session management and job queuing. At the center of everything is Claude, the AI agent that does the financial reasoning. And we connect to Xero and Stripe via proper OAuth 2.0 — not API keys rattling around in a config file. Every write operation is idempotent. Every action is logged. This was built to be handed to a production engineering team, not just demoed at a hackathon."

---
---

## SLIDE 6 — THE AI WORKFLOW

**Visual Description:**
A numbered step-by-step flow showing the exact reasoning chain the AI agent executes, with timing indicators.

```
USER CLICKS "EXPLAIN WITH AI"
            │
            ▼
  STEP 1 — FETCH  [~1.2s]
  ┌─────────────────────────────────────────────────────┐
  │ Pull 87 Stripe transactions for this payout period  │
  │ Retrieve payout metadata, fee schedules, FX rates   │
  └─────────────────────────────────────────────────────┘
            │
            ▼
  STEP 2 — MATCH  [~2.1s]
  ┌─────────────────────────────────────────────────────┐
  │ Search Xero for invoices matching each transaction  │
  │ Flag unmatched items (anomaly candidates)           │
  └─────────────────────────────────────────────────────┘
            │
            ▼
  STEP 3 — CALCULATE  [~0.8s]
  ┌─────────────────────────────────────────────────────┐
  │ Gross Sales - Stripe Fees - Refunds - FX = Net      │
  │ Verify net matches bank deposit to the cent         │
  └─────────────────────────────────────────────────────┘
            │
            ▼
  STEP 4 — GENERATE EVIDENCE  [~1.5s]
  ┌─────────────────────────────────────────────────────┐
  │ Link every figure to a real transaction ID          │
  │ Surface anomalies with confidence scores            │
  └─────────────────────────────────────────────────────┘
            │
            ▼
  STEP 5 — PROPOSE  [~2.4s]
  ┌─────────────────────────────────────────────────────┐
  │ Draft Xero journal entries for human review         │
  │ Suggest bank reconciliation actions                 │
  └─────────────────────────────────────────────────────┘
            │
            ▼
  HUMAN REVIEWS → APPROVES → EXECUTES
  Total AI time: ~8 seconds
```

---

**Key Message:**
The AI does not guess. It reasons step by step, the same way a forensic accountant would — but in 8 seconds instead of 45 minutes.

---

**Speaker Notes:**
"Here is exactly what happens when you click that button. The AI fetches your Stripe payout data — all 87 transactions for this period. It searches Xero for matching invoices, flagging anything that does not match. It calculates the complete math: gross sales minus fees minus refunds minus FX equals net payout. It then generates evidence — every single figure links to a real Stripe transaction ID or Xero record. Finally, it proposes journal entries and reconciliation actions for you to review. The entire process takes 8 seconds. You then spend 30 seconds reviewing the work and clicking Confirm. That is how we turn 45 minutes into under 2."

---
---

## SLIDE 7 — XERO INTEGRATION DEEP DIVE

**Visual Description:**
A full-width reference table showing all six Xero API endpoints, what data is consumed, and why each one is essential to the reconciliation workflow.

```
PAYTRACE AI × XERO — PRODUCTION API INTEGRATION

┌─────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ ENDPOINT                    │ WHAT WE DO WITH IT           │ WHY IT MATTERS               │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ GET /Invoices               │ Match Stripe charges to       │ Confirms real revenue vs.    │
│                             │ existing Xero invoices        │ unmatched transactions       │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ POST /Invoices              │ Create invoices for orders    │ Closes the gap when Xero is  │
│                             │ not yet entered in Xero       │ missing a record             │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ GET /BankTransactions       │ Retrieve bank feed entries    │ Establishes ground truth for │
│                             │ for the reconciliation period │ the bank-side of the match   │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ POST /BankTransactions      │ Create spend transactions     │ Records Stripe fees and       │
│                             │ for fees and adjustments      │ chargebacks as real entries  │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ PUT /BankTransactions/{id}  │ Reconcile bank statement      │ The actual reconciliation    │
│ /BankStatementLines/{id}/   │ lines to bank transactions    │ action — closes the loop     │
│ Reconcile                   │                               │                              │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ POST /ManualJournals        │ Post fee income, FX           │ Keeps the P&L and balance    │
│                             │ adjustments, and chargebacks  │ sheet accurate               │
└─────────────────────────────┴──────────────────────────────┴──────────────────────────────┘

OAuth 2.0 with PKCE | Refresh Token Management | Scoped Permissions | Webhook-ready
Idempotency keys on all write operations | Full error recovery | Tenant isolation
```

---

**Key Message:**
We are not wrapping one Xero endpoint. We are operating across the full spectrum of Xero's financial data model — reading, creating, reconciling, and journaling with production-grade safety.

---

**Speaker Notes:**
"Let me be specific about Xero, because this is where the real work lives. We use six distinct Xero API endpoints — and each one serves a critical role. We read invoices to match against Stripe charges. We create invoices when they are missing from Xero. We read bank transactions to establish the ground truth on the banking side. We create bank transactions to record fees and adjustments. We execute the actual reconciliation call against the bank statement line. And we post manual journal entries for the items that do not map neatly — FX adjustments, chargeback contra-entries, fee income. This is not a demo integration. This is a power user of the Xero API. Every write is idempotent. Every tenant is isolated. We handle token refresh, rate limits, and error recovery — the things that distinguish a real product from a prototype."

---
---

## SLIDE 8 — DEMO PREVIEW

**Visual Description:**
A five-panel storyboard with screenshot mockup frames, each labeled with the user action and system response.

```
  PANEL 1              PANEL 2              PANEL 3
  ┌───────────┐        ┌───────────┐        ┌───────────┐
  │           │        │           │        │           │
  │  BANK     │  ───►  │  CLICK    │  ───►  │  AI       │
  │  FEED     │        │  "EXPLAIN │        │  BREAKDOWN│
  │           │        │  WITH AI" │        │  CARD     │
  │ $8,742.63 │        │           │        │  8 seconds│
  │ [Explain] │        │  Progress │        │  complete │
  └───────────┘        │  spinner  │        └───────────┘
                       └───────────┘

  PANEL 4              PANEL 5
  ┌───────────┐        ┌───────────┐
  │           │        │           │
  │  ANOMALY  │  ───►  │  ONE-CLICK│
  │  DETECTED │        │  RECONCILE│
  │           │        │           │
  │ ⚠ Refund  │        │  Xero     │
  │ rate 3.2% │        │  Updated  │
  │ vs 1.6%   │        │  ✓ Done   │
  └───────────┘        └───────────┘

        Bank Feed → Click Explain → AI Breakdown → Anomaly → Reconcile
```

---

**Key Message:**
Five moments. Under two minutes. This is what the demo will show live.

---

**Speaker Notes:**
"Here is the arc of our live demo. We start on the bank feed dashboard where Marcus sees his payout of $8,742.63 sitting unreconciled. He clicks one button: Explain with AI. He watches a real-time progress indicator as the agent works — fetching Stripe data, searching Xero, running the math. Eight seconds later, he has a complete breakdown card. He expands a line item to see the evidence. Then — and this is the part that gets people — a yellow warning banner appears. The AI has detected an anomaly in the refund data. Marcus had not noticed it. His accountant had not flagged it. PayTrace AI caught it automatically. He clicks Reconcile Everything, reviews four proposed Xero actions, confirms, and watches the green success animation. Forty-five minutes of work. Under two minutes."

---
---

## SLIDE 9 — MARKET OPPORTUNITY

**Visual Description:**
A pyramid-style market sizing diagram with three levels, accompanied by a path-to-market arrow on the right side.

```
        TOTAL ADDRESSABLE MARKET
    ┌───────────────────────────────────────────────┐
    │                                               │
    │  4.4M Xero users globally                    │
    │  × 60% with payment processors               │
    │  = 2.6 million businesses with this problem  │
    │                                               │
    │  Value created: 15 hrs/month × $50/hr        │
    │  = $750/month per business in time saved      │
    │                                               │
    │  SaaS pricing: $30/seat/month                │
    │  TAM at 40% capture: $936 MILLION             │
    │                                               │
    └───────────────────────────────────────────────┘

                PATH TO MARKET
    [MVP Now] → [Xero App Store Q3] → [Shopify Channel Q4]
              → [Accounting Firms H2] → [White Label 2027]

    Comparable exits: Receipt Bank (Dext) $350M | Float $93M
    Wedge: Hackathon → Xero Partner → App Marketplace
```

---

**Key Message:**
This is not a niche. 2.6 million businesses share this exact problem, right now, inside the Xero ecosystem alone. The path to market is already lit.

---

**Speaker Notes:**
"Let's talk numbers. Xero has 4.4 million subscribers. Conservatively, 60% of them use a payment processor — Stripe, Square, PayPal. That is 2.6 million businesses, each losing an average of 15 hours a month on manual reconciliation. At even a modest $50-per-hour opportunity cost, each business is losing $750 a month in productivity. We charge $30 a seat. That is not a hard sell — it is a 25x ROI conversation. At 40% market capture, that is a $936 million TAM inside the Xero ecosystem alone. And the path to market is obvious: we are already building on Xero's platform. The Xero App Store is the distribution channel. Accounting firms are the referral engine. We have seen this playbook work — Receipt Bank was acquired for $350 million. We are building for the same wedge, with AI as the new moat."

---
---

## SLIDE 10 — ROADMAP + CLOSE

**Visual Description:**
A timeline roadmap on the top half and a strong closing statement on the bottom half.

```
ROADMAP

  NOW          MONTH 2        MONTH 3          MONTH 6         2027
  ┌──────┐    ┌──────┐       ┌──────┐         ┌──────┐        ┌──────┐
  │ MVP  │───►│Shopify│──────►│Month-│─────────►│Xero  │───────►│White │
  │      │    │Integr.│       │end   │         │App   │        │Label │
  │Stripe│    │       │       │Close │         │Store │        │API   │
  │+ Xero│    │Orders │       │Asst. │         │      │        │      │
  │+ AI  │    │+ Recon│       │AI CFO│         │Listed│        │Launch│
  └──────┘    └──────┘       └──────┘         └──────┘        └──────┘
  WORKING     RICHER          STICKIER         SCALE           MOAT

THE ASK
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Xero partnership pathway and App Store listing support              │
│  Feedback from Xero's financial API team on reconciliation limits    │
│  Introductions to 10 beta businesses in the Xero ecosystem           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

          "We started with a hackathon.
           We are shipping a product.
           The only question is how fast we scale."
```

---

**Key Message:**
The work is real. The architecture is production-ready. The market is enormous. We are not asking for permission — we are asking for momentum.

---

**Speaker Notes:**
"Here is where we go from here. Today you are seeing a working MVP — Stripe payout explanation, Xero reconciliation, AI anomaly detection, full audit trail. In Month 2, we add Shopify order correlation — the third data source that completes the picture. Month 3, we build the month-end close assistant — the AI CFO that proactively tells you what to do before you even ask. Month 6, we go live in the Xero App Store. And in 2027, we open a white-label API for accounting firms who want to embed this into their own tools. We are not here to show you a concept. We built something real. We started with a hackathon. We are shipping a product. The only question is how fast we scale. Thank you."

---

---
*PayTrace AI — Built at the Xero Hackathon. Production-grade from day one.*
