import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { runLabel } from "@/lib/reconciliation-data";
import { mapPayoutToRun } from "@/lib/map-payout";
import { usePayouts } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace · Reconciliation Agent" },
      {
        name: "description",
        content:
          "Workspace overview: recent reconciliations, flags to review, and the audit log.",
      },
    ],
  }),
  component: OverviewPage,
});

function money(n: number, sign = false) {
  const s = n < 0 ? "−" : sign ? "+" : "";
  return `${s}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "accent"
          ? "text-accent"
          : "text-foreground";
  return (
    <div className="ledger-card px-5 py-4">
      <div className="section-marker">{label}</div>
      <div className={`mt-2 font-tabular text-3xl ${toneClass}`}>{value}</div>
      {hint ? (
        <div className="mt-1 font-tabular text-[0.72rem] text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: "flagged" | "matched" | "posted" }) {
  const map = {
    flagged: { label: "flagged", cls: "border-danger/60 text-danger" },
    matched: { label: "matched", cls: "border-success/50 text-success" },
    posted: { label: "posted", cls: "border-accent/60 text-accent" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest ${cls}`}
    >
      {label}
    </span>
  );
}

function OverviewPage() {
  const { data: payouts = [], isLoading, error } = usePayouts();
  const runs = payouts.map((p) => mapPayoutToRun(p));
  const flagged = runs.filter((r) => r.status === "flagged");
  const recent = runs.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="section-marker mb-1">workspace</div>
          <h1 className="truncate text-3xl leading-tight sm:text-4xl">
            Good afternoon, Ada.
          </h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {isLoading
              ? "Loading payouts from Stripe…"
              : error
                ? "Could not load payouts."
                : `The agent is tracking ${runs.length} payouts. ${flagged.length} need your attention.`}
          </p>
        </div>
        <Link
          to="/reconciliations"
          className="inline-flex items-center gap-2 border border-accent bg-accent px-3 py-2 font-tabular text-[0.7rem] uppercase tracking-[0.16em] text-accent-foreground shadow-[0_3px_0_0_rgba(28,43,42,0.15)] hover:translate-y-[1px] hover:shadow-[0_2px_0_0_rgba(28,43,42,0.15)]"
        >
          view all reconciliations <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kpi label="payouts synced" value={String(runs.length)} />
        <Kpi
          label="flagged · open"
          value={String(flagged.length)}
          tone="danger"
          hint="need review"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="ledger-card">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <div className="section-marker">recent reconciliations</div>
            <Link
              to="/reconciliations"
              className="font-tabular text-[0.7rem] uppercase tracking-widest text-accent hover:underline"
            >
              all →
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule">
                <th className="section-marker px-5 py-2 text-left">payout</th>
                <th className="section-marker px-3 py-2 text-right">net</th>
                <th className="section-marker px-3 py-2 text-right">Δ</th>
                <th className="section-marker px-3 py-2 text-left">status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-rule/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-tabular text-sm">{runLabel(r)}</div>
                    <div className="font-tabular text-[0.68rem] text-muted-foreground">
                      {r.payoutId}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-tabular text-xs">
                    {money(r.net)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-tabular text-xs ${
                      r.discrepancy < 0 ? "text-danger" : "text-muted-foreground"
                    }`}
                  >
                    {r.discrepancy === 0 ? "—" : money(r.discrepancy)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to="/reconciliations/$runId"
                      params={{ runId: r.id }}
                      className="font-tabular text-[0.7rem] uppercase tracking-widest text-accent hover:underline"
                    >
                      open →
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No payouts yet — connect Stripe and sync from Connections.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="ledger-card">
          <div className="border-b border-rule px-5 py-3">
            <div className="section-marker">needs review</div>
          </div>
          <div className="divide-y divide-rule/60">
            {flagged.map((r) => (
              <Link
                key={r.id}
                to="/reconciliations/$runId"
                params={{ runId: r.id }}
                className="flex items-start gap-3 px-5 py-4 hover:bg-danger/[0.04]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-tabular text-xs">{runLabel(r)}</span>
                    <span className="section-marker">·</span>
                    <span className="font-tabular text-xs">{r.payoutId}</span>
                  </div>

                  <div className="mt-1 text-sm text-foreground">{r.reason}</div>
                  <div className="mt-1 font-tabular text-[0.7rem] text-muted-foreground">
                    Δ {money(r.discrepancy)} · confidence{" "}
                    {Math.round(r.confidence * 100)}%
                  </div>
                </div>
              </Link>
            ))}
            {flagged.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" /> No open flags.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
