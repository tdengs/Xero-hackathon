import { useState } from "react";
import { Check, X } from "lucide-react";
import type { NextStep } from "@/lib/reconciliation-data";

function KindChip({ kind }: { kind: NextStep["kind"] }) {
  const map = {
    rule: { label: "rule", cls: "border-accent/60 text-accent bg-accent/[0.06]" },
    monitor: {
      label: "monitor",
      cls: "border-amber-600/60 text-amber-700 bg-amber-500/[0.08] dark:text-amber-400",
    },
    "one-off": {
      label: "one-off",
      cls: "border-rule text-muted-foreground bg-muted/40",
    },
  } as const;
  const { label, cls } = map[kind];
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-tabular text-[0.6rem] uppercase tracking-widest ${cls}`}
    >
      {label}
    </span>
  );
}

export function NextSteps({
  steps,
  onApprove,
  approving = false,
  approveMessage,
}: {
  steps: NextStep[];
  onApprove?: () => void;
  approving?: boolean;
  approveMessage?: string | null;
}) {
  const [state, setState] = useState<Record<number, "accepted" | "dismissed" | null>>({});

  return (
    <div className="ledger-card">
      <div className="border-b border-rule px-5 py-3 flex items-center justify-between gap-3">
        <div className="section-marker">suggested actions</div>
        {onApprove ? (
          <button
            onClick={onApprove}
            disabled={approving}
            className="border border-accent bg-accent px-3 py-1.5 font-tabular text-[0.62rem] uppercase tracking-widest text-accent-foreground shadow-[0_3px_0_0_rgba(28,43,42,0.15)] disabled:opacity-60"
          >
            {approving ? "posting…" : "post to xero"}
          </button>
        ) : null}
      </div>
      {approveMessage ? (
        <div className="border-b border-rule bg-success/[0.06] px-5 py-2 font-tabular text-[0.78rem] text-success">
          {approveMessage}
        </div>
      ) : null}
      <div className="divide-y divide-rule/60">
        {steps.map((step, i) => {
          const status = state[i];
          const dismissed = status === "dismissed";
          const accepted = status === "accepted";
          return (
            <div
              key={i}
              className={`grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4 transition-opacity ${
                dismissed ? "opacity-40" : ""
              }`}
            >
              <div className="pt-0.5">
                <KindChip kind={step.kind} />
              </div>
              <div className="min-w-0">
                <div
                  className={`font-tabular text-sm ${
                    dismissed ? "line-through" : "text-foreground"
                  }`}
                >
                  {step.label}
                </div>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-foreground/75">
                  {step.detail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {accepted ? (
                  <span className="inline-flex items-center gap-1 font-tabular text-[0.65rem] uppercase tracking-widest text-success">
                    <Check className="h-3 w-3" /> accepted
                  </span>
                ) : dismissed ? (
                  <button
                    onClick={() => setState((s) => ({ ...s, [i]: null }))}
                    className="font-tabular text-[0.65rem] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    undo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setState((s) => ({ ...s, [i]: "accepted" }))}
                      className="border border-accent bg-accent px-2.5 py-1 font-tabular text-[0.62rem] uppercase tracking-widest text-accent-foreground hover:translate-y-[1px]"
                    >
                      accept
                    </button>
                    <button
                      onClick={() => setState((s) => ({ ...s, [i]: "dismissed" }))}
                      className="inline-flex items-center gap-1 border border-rule px-2 py-1 font-tabular text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3 w-3" /> dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
