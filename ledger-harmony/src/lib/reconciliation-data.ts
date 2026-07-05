// ---------- Runs & audit ----------

export type RunStatus = "flagged" | "matched" | "posted";
export type IssueKind = "refund-timing" | "fx-conversion" | "dispute-lifecycle";

export const issueLabel: Record<IssueKind, string> = {
  "refund-timing": "Refund timing",
  "fx-conversion": "FX drift",
  "dispute-lifecycle": "Dispute",
};

export type MatchedItem = {
  label: string;
  amount: number;
  xeroRef: string;
};

export type StripeType =
  | "gross"
  | "fee"
  | "refund"
  | "dispute"
  | "dispute-fee"
  | "fx";

export type XeroType =
  | "invoice"
  | "bill"
  | "credit-note"
  | "expense"
  | "journal";

export const stripeTypeLabel: Record<StripeType, string> = {
  gross: "gross sale",
  fee: "processing fee",
  refund: "refund",
  dispute: "chargeback",
  "dispute-fee": "dispute fee",
  fx: "fx delta",
};

export const xeroTypeLabel: Record<XeroType, string> = {
  invoice: "invoice",
  bill: "bill",
  "credit-note": "credit note",
  expense: "expense",
  journal: "journal",
};

export type ReconciliationRow = {
  stripe: {
    date: string;
    payee: string;
    label: string;
    amount: number;
    type: StripeType;
  };
  xero:
    | {
        ref: string;
        label: string;
        type: XeroType;
        amount: number;
        confidence: number;
      }
    | null;
  suggestion?: { type: XeroType; label: string };
};

export const xeroEndpoint: Record<XeroType, string> = {
  invoice: "GET /api.xro/2.0/Invoices",
  bill: "GET /api.xro/2.0/Invoices?type=ACCPAY",
  "credit-note": "GET /api.xro/2.0/CreditNotes",
  expense: "GET /api.xro/2.0/BankTransactions",
  journal: "GET /api.xro/2.0/ManualJournals",
};


export type Run = {
  id: string;
  date: string;
  payoutId: string;
  currency: "USD" | "NZD";
  gross: number;
  net: number;
  orders: number;
  discrepancy: number;
  status: RunStatus;
  issue?: IssueKind;
  reason: string;
  confidence: number;
  // For cleanly-matched runs — every payout line found its Xero counterpart.
  matchedItems?: MatchedItem[];
  rows?: ReconciliationRow[];
};


export const runs: Run[] = [
  {
    id: "payout-2026-07-04",
    date: "2026-07-04",
    payoutId: "po_88a1",
    currency: "USD",
    gross: 363.75,
    net: 227.30,
    orders: 5,
    discrepancy: -124.35,
    status: "flagged",
    issue: "refund-timing",
    reason:
      "3 lines unmatched — late refund, chargeback + fee, and FX settlement delta",
    confidence: 0.93,
  },


  {
    id: "payout-2026-07-02",
    date: "2026-07-02",
    payoutId: "po_889k",
    currency: "USD",
    gross: 842.0,
    net: 817.74,
    orders: 6,
    discrepancy: 0,
    status: "matched",
    reason: "Payout reconciles cleanly against Xero — all items matched",
    confidence: 0.99,
    matchedItems: [
      { label: "invoice INV-2041 · Order #2041", amount: 148.0, xeroRef: "INV-2041" },
      { label: "invoice INV-2042 · Order #2042", amount: 92.5, xeroRef: "INV-2042" },
      { label: "invoice INV-2043 · Order #2043", amount: 210.0, xeroRef: "INV-2043" },
      { label: "invoice INV-2044 · Order #2044", amount: 76.5, xeroRef: "INV-2044" },
      { label: "invoice INV-2045 · Order #2045", amount: 189.0, xeroRef: "INV-2045" },
      { label: "invoice INV-2046 · Order #2046", amount: 126.0, xeroRef: "INV-2046" },
      { label: "Stripe processing fees (bill)", amount: -24.26, xeroRef: "BILL-STRP-0702" },
    ],
    rows: [
      {
        stripe: { date: "2026-06-30", payee: "Maren Aoki", label: "Order #2041 · charge ch_1P41", amount: 148.0, type: "gross" },
        xero: { ref: "INV-2041", label: "Invoice · Maren Aoki", type: "invoice", amount: 148.0, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-06-30", payee: "Devon Cho", label: "Order #2042 · charge ch_1P42", amount: 92.5, type: "gross" },
        xero: { ref: "INV-2042", label: "Invoice · Devon Cho", type: "invoice", amount: 92.5, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-07-01", payee: "Iris Nakamura", label: "Order #2043 · charge ch_1P43", amount: 210.0, type: "gross" },
        xero: { ref: "INV-2043", label: "Invoice · Iris Nakamura", type: "invoice", amount: 210.0, confidence: 0.98 },
      },
      {
        stripe: { date: "2026-07-01", payee: "Rafael Costa", label: "Order #2044 · charge ch_1P44", amount: 76.5, type: "gross" },
        xero: { ref: "INV-2044", label: "Invoice · Rafael Costa", type: "invoice", amount: 76.5, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-07-02", payee: "Naomi Beck", label: "Order #2045 · charge ch_1P45", amount: 189.0, type: "gross" },
        xero: { ref: "INV-2045", label: "Invoice · Naomi Beck", type: "invoice", amount: 189.0, confidence: 0.97 },
      },
      {
        stripe: { date: "2026-07-02", payee: "Priya Menon", label: "Order #2046 · charge ch_1P46", amount: 126.0, type: "gross" },
        xero: { ref: "INV-2046", label: "Invoice · Priya Menon", type: "invoice", amount: 126.0, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-07-02", payee: "Stripe, Inc.", label: "Processing fees · payout po_889k", amount: -24.26, type: "fee" },
        xero: { ref: "BILL-STRP-0702", label: "Bill · Stripe processing fees", type: "bill", amount: -24.26, confidence: 0.96 },
      },
    ],


  },
];

export const kpis = {
  reconciledToday: 2,
  flaggedOpen: 1,
  postedThisWeek: 6,
  autoMatchRate: 0.92,
  valueReconciled7d: 4820.15,
};

// Friendly label for a run — used in tables and headings instead of an opaque id.
export function runLabel(run: { date: string }) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(run.date));
}



// ---------- Sources (Stripe + Xero + LLM) ----------

export type Source = {
  id: "stripe" | "xero";
  name: string;
  account: string;
  status: "connected" | "degraded";
};

export const sources: Source[] = [
  {
    id: "stripe",
    name: "Stripe",
    account: "acct_1PxQ...B7",
    status: "connected",
  },
  {
    id: "xero",
    name: "Xero",
    account: "Atelier Outfitters Ltd — NZD",
    status: "connected",
  },
];

// ---------- Per-issue reasoning content ----------

export type PayoutLine = {
  label: string;
  amount: number;
  // If present, the Xero item this payout line matched against.
  // If absent, this line is unmatched — the source of the discrepancy.
  xeroRef?: string;
};

export type XeroLine = {
  label: string;
  amount: number;
  currency: "USD" | "NZD";
  status: "unmatched";
};

export type Step = {
  kind: "match" | "flag";
  figures: string;
  text: string;
};

export type JournalLine = {
  account: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export type NextStep = {
  kind: "rule" | "monitor" | "one-off";
  label: string;
  detail: string;
};

export type IssueContent = {
  headline: string;
  payoutLines: PayoutLine[];
  rows?: ReconciliationRow[];
  payoutNet: number;
  payoutCurrency: "USD" | "NZD";

  xeroTxn: XeroLine;
  reasoning: Step[];
  diagnosis: string;
  action: string;
  journal: JournalLine[];
  journalCurrency: "USD" | "NZD";
  writeBackTitle: string;

  // Clearing-account invariant
  stripeBalance: number;
  clearingBefore: number;
  clearingCurrency: "USD" | "NZD";

  nextSteps: NextStep[];
};

export const issueContent: Record<IssueKind, IssueContent> = {
  "refund-timing": {
    headline: "Late refund, chargeback, and FX drift left three lines unmatched",
    payoutLines: [
      { label: "invoice INV-1041 · Order #1041", amount: 62.25, xeroRef: "INV-1041" },
      { label: "invoice INV-1042 · Order #1042", amount: 48.5, xeroRef: "INV-1042" },
      { label: "invoice INV-1043 · Order #1043", amount: 45.0, xeroRef: "INV-1043" },
      { label: "invoice INV-1044 · Order #1044", amount: 88.0, xeroRef: "INV-1044" },
      { label: "invoice INV-1045 · Order #1045", amount: 120.0, xeroRef: "INV-1045" },
      { label: "Stripe processing fee", amount: -12.1, xeroRef: "BILL-STRP-0704" },
      { label: "refund #1043 (post-payout)", amount: -32.5 },
      { label: "chargeback d_9F2 · Order #1044", amount: -75.0 },
      { label: "chargeback fee d_9F2", amount: -15.0 },
      { label: "fx settlement delta · bank vs Stripe rate", amount: -1.85 },
    ],
    rows: [
      {
        stripe: { date: "2026-07-03", payee: "Elin Warrick", label: "Order #1041 · charge ch_1P1041", amount: 62.25, type: "gross" },
        xero: { ref: "INV-1041", label: "Invoice · Elin Warrick", type: "invoice", amount: 62.25, confidence: 0.98 },
      },
      {
        stripe: { date: "2026-07-03", payee: "Marcus Held", label: "Order #1042 · charge ch_1P1042", amount: 48.5, type: "gross" },
        xero: { ref: "INV-1042", label: "Invoice · Marcus Held", type: "invoice", amount: 48.5, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-07-03", payee: "Sonja Lehr", label: "Order #1043 · charge ch_1P1043", amount: 45.0, type: "gross" },
        xero: { ref: "INV-1043", label: "Invoice · Sonja Lehr", type: "invoice", amount: 45.0, confidence: 0.97 },
      },
      {
        stripe: { date: "2026-07-03", payee: "Kai Ostrowski", label: "Order #1044 · charge ch_1P1044", amount: 88.0, type: "gross" },
        xero: { ref: "INV-1044", label: "Invoice · Kai Ostrowski", type: "invoice", amount: 88.0, confidence: 0.98 },
      },
      {
        stripe: { date: "2026-07-04", payee: "Yuki Tan", label: "Order #1045 · charge ch_1P1045", amount: 120.0, type: "gross" },
        xero: { ref: "INV-1045", label: "Invoice · Yuki Tan", type: "invoice", amount: 120.0, confidence: 0.99 },
      },
      {
        stripe: { date: "2026-07-04", payee: "Stripe, Inc.", label: "Processing fees · payout po_88a1", amount: -12.1, type: "fee" },
        xero: { ref: "BILL-STRP-0704", label: "Bill · Stripe processing fees", type: "bill", amount: -12.1, confidence: 0.95 },
      },
      {
        stripe: { date: "2026-07-04", payee: "Sonja Lehr", label: "Refund · Order #1043 (post-payout)", amount: -32.5, type: "refund" },
        xero: null,
        suggestion: {
          type: "credit-note",
          label: "Credit note against Invoice INV-1043 for −$32.50",
        },
      },
      {
        stripe: { date: "2026-07-04", payee: "Kai Ostrowski", label: "Chargeback d_9F2 · Order #1044 disputed", amount: -75.0, type: "dispute" },
        xero: null,
        suggestion: {
          type: "expense",
          label: "Expense to Stripe Disputes for $75.00 (provisional loss)",
        },
      },
      {
        stripe: { date: "2026-07-04", payee: "Stripe, Inc.", label: "Non-refundable dispute fee · d_9F2", amount: -15.0, type: "dispute-fee" },
        xero: null,
        suggestion: {
          type: "bill",
          label: "Bill to Stripe Processing Fees for $15.00 (non-refundable)",
        },
      },
      {
        stripe: { date: "2026-07-04", payee: "Bank settlement", label: "FX delta · Stripe 1.6500 → Bank 1.6486 on USD 227.30", amount: -1.85, type: "fx" },
        xero: null,
        suggestion: {
          type: "journal",
          label: "Manual journal · FX loss $1.85 vs Foreign Exchange Gains/Losses",
        },
      },
    ],


    payoutNet: 227.30,
    payoutCurrency: "USD",
    xeroTxn: {
      label: "bank txn 04/07",
      amount: 227.30,
      currency: "USD",
      status: "unmatched",
    },
    reasoning: [
      {
        kind: "match",
        figures: "gross  $363.75   → 5 orders",
        text: "Bundled Stripe payout decomposed into gross sales for the five underlying orders. Each matched a Xero invoice on payee + amount.",
      },
      {
        kind: "match",
        figures: "fee    −$12.10",
        text: "Processing fee extracted from the net payout and matched to the Stripe fees bill.",
      },
      {
        kind: "flag",
        figures: "refund #1043  −$32.50   confidence: 94%",
        text: "Refund on Order #1043 was issued after this payout settled. No credit note exists in Xero yet — Stripe Clearing is over by $32.50.",
      },
      {
        kind: "flag",
        figures: "chargeback d_9F2  −$75.00 + fee −$15.00   confidence: 91%",
        text: "Chargeback on Order #1044 deducted $75.00 plus a $15.00 non-refundable fee. Nothing in Xero reflects the loss yet — the $75 needs a Stripe Disputes expense, the $15 a Stripe fees bill.",
      },
      {
        kind: "flag",
        figures: "fx settlement delta  −$1.85   confidence: 88%",
        text: "Stripe reported the payout at rate 1.6500 but the bank settled at 1.6486. That $1.85 gap has to book to Foreign Exchange Gains/Losses via a manual journal.",
      },
    ],
    diagnosis:
      "Stripe Clearing is $124.35 higher than Stripe's balance: a $32.50 late refund, a $75 + $15 chargeback, and a $1.85 FX settlement delta are all missing from Xero.",
    action:
      "Post four Xero records — credit note for the refund, expense + bill for the chargeback, and a manual FX journal — to close the payout cleanly.",
    journal: [
      {
        account: "Sales Revenue",
        debit: 32.5,
        memo: "Reversal — Refund #1043 (Order #1043)",
      },
      {
        account: "Stripe Disputes",
        debit: 75.0,
        memo: "Chargeback d_9F2 — provisional loss on Order #1044",
      },
      {
        account: "Stripe Processing Fees",
        debit: 15.0,
        memo: "Non-refundable dispute fee d_9F2",
      },
      {
        account: "Foreign Exchange Gains/Losses",
        debit: 1.85,
        memo: "FX settlement delta 1.6500 → 1.6486",
      },
      {
        account: "Stripe Clearing",
        credit: 124.35,
        memo: "Clears late refund + chargeback + FX delta from payout po_88a1",
      },
    ],
    journalCurrency: "USD",
    writeBackTitle: "proposed journal · Xero",
    stripeBalance: 12480.15,
    clearingBefore: 12604.5,
    clearingCurrency: "USD",
    nextSteps: [
      {
        kind: "rule",
        label: "Auto-split late refunds",
        detail:
          "Whenever a refund lands after its payout closes, post it as its own credit note against the original invoice. Would apply to ~47 future payouts.",
      },
      {
        kind: "rule",
        label: "Auto-post chargebacks + fees",
        detail:
          "Split every dispute deduction into Stripe Disputes (loss) + Stripe Processing Fees (non-refundable). Would apply to all future disputes.",
      },
      {
        kind: "rule",
        label: "Auto-book FX settlement drift",
        detail:
          "Route rate deltas between Stripe's reported and the bank's booked amount to Foreign Exchange Gains/Losses via a manual journal.",
      },
      {
        kind: "one-off",
        label: "Notify #finance in Slack",
        detail:
          "Payout po_88a1 has three unmatched lines totalling −$124.35 — flag for the weekly review.",
      },
    ],
  },

  "fx-conversion": {
    headline: "Bank booked the payout at a different FX rate",
    payoutLines: [
      { label: "gross sales (12 orders)", amount: 500.0 },
      { label: "processing fee", amount: -14.5 },
    ],
    payoutNet: 485.5,
    payoutCurrency: "USD",
    xeroTxn: {
      label: "bank deposit 30/06 (NZD)",
      amount: 802.14,
      currency: "NZD",
      status: "unmatched",
    },
    reasoning: [
      {
        kind: "match",
        figures: "gross  $500.00 USD   → 12 orders",
        text: "Bundled USD payout decomposed into gross sales across twelve orders.",
      },
      {
        kind: "match",
        figures: "fee    −$14.50 USD",
        text: "Processing fee separated from net payout and posted to Stripe fees.",
      },
      {
        kind: "flag",
        figures: "FX drift  NZD +$1.06   (Stripe 1.6500 → Bank 1.6521)",
        text: "Stripe reports USD $485.50 at 1.6500 → NZD $801.08. Bank actually deposited NZD $802.14 at 1.6521. Clearing needs the NZD $1.06 delta booked as an FX gain.",
      },
    ],
    diagnosis:
      "Stripe Clearing is short NZD $1.06 because the bank converted at 1.6521 while Stripe reported 1.6500.",
    action:
      "Post the deposit at the bank's actual amount and route the rate delta to Foreign Exchange Gains/Losses.",
    journal: [
      {
        account: "Stripe Clearing",
        debit: 1.06,
        memo: "FX rate delta — 1.6500 → 1.6521",
      },
      {
        account: "Foreign Exchange Gains/Losses",
        credit: 1.06,
        memo: "Gain on USD→NZD settlement, payout po_889v",
      },
    ],
    journalCurrency: "NZD",
    writeBackTitle: "proposed journal · Xero",
    stripeBalance: 801.08,
    clearingBefore: 800.02,
    clearingCurrency: "NZD",
    nextSteps: [
      {
        kind: "rule",
        label: "Auto-book FX drift",
        detail:
          "Route rate deltas on NZD deposits directly to Foreign Exchange Gains/Losses. Would apply to every future USD→NZD payout.",
      },
      {
        kind: "monitor",
        label: "Watch NZD/USD spread",
        detail:
          "Third drift this week — the bank is consistently 12–20 bps off Stripe's mid-rate. Worth pricing into the next quarter's forecast.",
      },
    ],
  },
  "dispute-lifecycle": {
    headline: "Dispute debited the payout across two entries",
    payoutLines: [
      { label: "gross sales (8 orders)", amount: 1240.0 },
      { label: "processing fee", amount: -35.94 },
      { label: "dispute d_9F2 (chargeback)", amount: -500.0 },
      { label: "dispute d_9F2 fee", amount: -15.0 },
    ],
    payoutNet: 689.06,
    payoutCurrency: "USD",
    xeroTxn: {
      label: "bank txn 03/07",
      amount: 689.06,
      currency: "USD",
      status: "unmatched",
    },
    reasoning: [
      {
        kind: "match",
        figures: "gross  $1,240.00   → 8 orders",
        text: "Bundled Stripe payout decomposed into gross sales for the eight underlying orders.",
      },
      {
        kind: "match",
        figures: "fee    −$35.94",
        text: "Processing fee separated from net payout and posted to Stripe Processing Fees.",
      },
      {
        kind: "flag",
        figures: "dispute d_9F2   −$515.00   confidence: 91%",
        text: "Chargeback on charge ch_1P… deducted $500 plus a $15 dispute fee. Clearing has to reflect both immediately — the $500 as a realised loss, the $15 as a non-refundable fee. If we win the dispute later, only the $500 comes back.",
      },
    ],
    diagnosis:
      "Stripe Clearing is $515 higher than Stripe's balance because the chargeback and its non-refundable fee haven't hit the ledger.",
    action:
      "Post the $500 to Stripe Disputes and the $15 to Stripe Processing Fees, then queue the reversal to watch for 60 days.",
    journal: [
      {
        account: "Stripe Disputes",
        debit: 500.0,
        memo: "Chargeback d_9F2 — provisional loss",
      },
      {
        account: "Stripe Processing Fees",
        debit: 15.0,
        memo: "Non-refundable dispute fee",
      },
      {
        account: "Stripe Clearing",
        credit: 515.0,
        memo: "Clears dispute deduction from payout po_88b3",
      },
    ],
    journalCurrency: "USD",
    writeBackTitle: "proposed journal · Xero",
    stripeBalance: 8420.11,
    clearingBefore: 8935.11,
    clearingCurrency: "USD",
    nextSteps: [
      {
        kind: "monitor",
        label: "Track dispute d_9F2 for reversal",
        detail:
          "Watch window is 60 days. Expected resolution by 2026-09-02. If you win, the $500 returns on a future payout and Disputes reverses; the $15 fee stays.",
      },
      {
        kind: "rule",
        label: "Auto-post future chargebacks",
        detail:
          "Split every dispute deduction into Stripe Disputes + Stripe Processing Fees on receipt. Would apply to all future disputes.",
      },
    ],
  },
};

export const agentQuestion = "Why doesn't this payout match the bank deposit?";
