import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, RefreshCw } from "lucide-react";
import {
  stripeTypeLabel,
  type ReconciliationRow,
  type StripeType,
} from "@/lib/reconciliation-data";

function fmt(n: number, currency: "USD" | "NZD") {
  const symbol = currency === "USD" ? "$" : "NZ$";
  return `${n < 0 ? "−" : ""}${symbol}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Timing (ms) — per row.
const FETCH_DELAY = 380;
const RESOLVE_MS = 620;

type RowState = "idle" | "fetching" | "resolved";

const unmatchedExplanation: Record<StripeType, string> = {
  gross:
    "No matching invoice was found in Xero for this charge — it may not have been raised yet.",
  fee: "No corresponding Stripe fees bill exists in Xero for this deduction.",
  refund:
    "This refund was issued after the payout settled, so Xero has no credit note against the original invoice yet.",
  dispute:
    "The chargeback loss has not been booked in Xero — it needs a Stripe Disputes expense to offset the deduction.",
  "dispute-fee":
    "The non-refundable dispute fee has not been recorded in Xero as a Stripe processing fees bill.",
  fx: "The bank settled at a different FX rate than Stripe reported, leaving a small delta with no journal in Xero.",
};

export function PayoutVsXero({
  payoutId,
  currency,
  rows,
  net,
}: {
  payoutId: string;
  currency: "USD" | "NZD";
  rows: ReconciliationRow[];
  net: number;
}) {
  const [states, setStates] = useState<RowState[]>(() => rows.map(() => "idle"));
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [runKey, setRunKey] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setStates(rows.map(() => "idle"));
    setExpanded(new Set());
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    rows.forEach((_, i) => {
      const startFetch = 200 + i * FETCH_DELAY;
      const finish = startFetch + RESOLVE_MS;
      timersRef.current.push(
        setTimeout(() => {
          setStates((s) => {
            const n = [...s];
            n[i] = "fetching";
            return n;
          });
        }, startFetch),
      );
      timersRef.current.push(
        setTimeout(() => {
          setStates((s) => {
            const n = [...s];
            n[i] = "resolved";
            return n;
          });
        }, finish),
      );
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [rows, runKey]);

  const unmatched = useMemo(() => rows.filter((r) => !r.xero), [rows]);
  const discrepancy = useMemo(
    () => unmatched.reduce((s, r) => s + r.stripe.amount, 0),
    [unmatched],
  );
  const allResolved = states.every((s) => s === "resolved");
  const hasUnmatched = unmatched.length > 0;

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="section-marker">
          agent is fetching xero records to match each stripe line
        </div>
        <button
          onClick={() => setRunKey((k) => k + 1)}
          className="inline-flex items-center gap-1 border border-rule bg-card px-2 py-1 font-tabular text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          aria-label="Replay matching animation"
        >
          <RefreshCw className="h-3 w-3" /> replay
        </button>
      </div>

      {/* Diagnosis banner */}
      <div
        className={`mb-3 flex items-center gap-2 border px-4 py-2.5 transition-opacity duration-300 ${
          allResolved ? "opacity-100" : "opacity-60"
        } ${
          hasUnmatched
            ? "border-danger/50 bg-danger/[0.06] text-danger"
            : "border-success/50 bg-success/[0.06] text-success"
        }`}
      >
        {hasUnmatched ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Check className="h-4 w-4 shrink-0" />
        )}
        <span className="font-tabular text-[0.85rem]">
          {hasUnmatched
            ? `Xero is missing ${fmt(Math.abs(discrepancy), currency)} — ${unmatched.length} ${unmatched.length === 1 ? "item" : "items"} unmatched`
            : `All ${rows.length} payout lines reconciled cleanly against Xero`}
        </span>
      </div>

      {/* Table */}
      <div className="ledger-card overflow-hidden">
        <div className="border-b border-rule bg-muted/30 px-5 py-2">
          <div className="section-marker">
            stripe payout · {payoutId}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1.5rem_minmax(0,2.4fr)_7rem_minmax(0,2fr)_9rem] items-center gap-3 border-b border-rule bg-muted/20 px-5 py-2">
          <div />
          <div className="section-marker">payout line</div>
          <div className="section-marker text-right">amount</div>
          <div className="section-marker">xero match</div>
          <div className="section-marker text-right">status</div>
        </div>

        <div className="divide-y divide-rule/60">
          {rows.map((r, i) => {
            const state = states[i];
            const matched = !!r.xero;
            const isOpen = expanded.has(i);
            const isFetching = state === "fetching";
            const isResolved = state === "resolved";

            const rowTint = !isResolved
              ? isFetching
                ? "bg-accent/[0.05]"
                : ""
              : matched
                ? "bg-success/[0.05]"
                : "bg-warning/[0.06]";

            return (
              <div key={i}>
                <div
                  className={`grid grid-cols-[1.5rem_minmax(0,2.4fr)_7rem_minmax(0,2fr)_9rem] items-center gap-3 px-5 py-3 transition-colors duration-300 ${rowTint}`}
                >
                  {/* Expand chevron — only for unmatched */}
                  <div>
                    {isResolved && !matched ? (
                      <button
                        onClick={() => toggle(i)}
                        aria-label={isOpen ? "Hide explanation" : "Show explanation"}
                        aria-expanded={isOpen}
                        className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    ) : null}
                  </div>

                  {/* Payout line: payee + description */}
                  <div className="min-w-0">
                    <div className="truncate font-tabular text-sm leading-tight">
                      {r.stripe.payee}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="inline-flex shrink-0 items-center border border-rule px-1.5 py-0.5 font-tabular text-[0.55rem] uppercase tracking-widest text-muted-foreground">
                        {stripeTypeLabel[r.stripe.type]}
                      </span>
                      <span className="truncate font-tabular text-[0.72rem] text-muted-foreground">
                        {r.stripe.label}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right font-tabular text-sm tabular-nums">
                    {fmt(r.stripe.amount, currency)}
                  </div>

                  {/* Xero match — always visible */}
                  <div className="min-w-0 font-tabular text-[0.82rem]">
                    {!isResolved ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            isFetching ? "bg-accent" : "bg-muted-foreground/30"
                          }`}
                          style={
                            isFetching
                              ? { animation: "pulse 0.9s ease-in-out infinite" }
                              : undefined
                          }
                        />
                        <span className="text-[0.72rem] uppercase tracking-widest">
                          {isFetching ? "matching…" : "queued"}
                        </span>
                      </span>
                    ) : matched && r.xero ? (
                      <span className="animate-fade-in truncate">
                        <span className="text-foreground">{r.xero.ref}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          ({fmt(r.xero.amount, currency)})
                        </span>
                      </span>
                    ) : (
                      <span className="animate-fade-in text-danger">
                        No counterpart found
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-end">
                    {!isResolved ? (
                      <span className="font-tabular text-[0.72rem] uppercase tracking-widest text-muted-foreground">
                        …
                      </span>
                    ) : matched && r.xero ? (
                      <span className="inline-flex animate-fade-in items-center gap-1.5 text-success">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        <span className="font-tabular text-[0.78rem]">
                          Matched · {Math.round(r.xero.confidence * 100)}%
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex animate-fade-in items-center gap-1.5 text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
                        <span className="font-tabular text-[0.78rem]">
                          Unmatched · 0%
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Expandable explanation for unmatched */}
                {isResolved && !matched && isOpen ? (
                  <div className={`${rowTint} border-t border-rule/50 px-5 pb-4 pt-2`}>
                    <div className="ml-[1.5rem] border-l-2 border-warning/50 bg-background/40 px-4 py-3">
                      <div className="section-marker mb-1 text-warning">
                        why unmatched
                      </div>
                      <p className="font-tabular text-[0.82rem] leading-relaxed text-foreground">
                        {unmatchedExplanation[r.stripe.type]}
                      </p>
                      {r.suggestion ? (
                        <p className="mt-2 font-tabular text-[0.78rem] text-muted-foreground">
                          <span className="uppercase tracking-widest text-[0.62rem]">
                            suggested fix ·{" "}
                          </span>
                          {r.suggestion.label}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Net payout total */}
        <div className="grid grid-cols-[1fr_auto] items-center border-t-2 border-foreground bg-muted/20 px-5 py-3">
          <div className="font-tabular text-[0.8rem] font-semibold uppercase tracking-widest">
            Net Payout
          </div>
          <div className="text-right font-tabular text-base font-semibold tabular-nums">
            {fmt(net, currency)}
          </div>
        </div>
      </div>
    </div>
  );
}
