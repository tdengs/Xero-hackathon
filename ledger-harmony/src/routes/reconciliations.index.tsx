import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { runLabel, type RunStatus } from "@/lib/reconciliation-data";
import { mapPayoutToRun } from "@/lib/map-payout";
import { usePayouts } from "@/lib/queries";

export const Route = createFileRoute("/reconciliations/")({
  head: () => ({
    meta: [
      { title: "Reconciliations · Reconciliation Agent" },
      {
        name: "description",
        content: "Every payout the agent has reconciled across Shopify, Stripe, and Xero.",
      },
    ],
  }),
  component: RunsList,
});

function money(n: number) {
  const s = n < 0 ? "−" : "";
  return `${s}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const filters: { id: "all" | RunStatus; label: string }[] = [
  { id: "all", label: "all" },
  { id: "flagged", label: "flagged" },
  { id: "matched", label: "matched" },
  { id: "posted", label: "posted" },
];

function RunsList() {
  const [filter, setFilter] = useState<"all" | RunStatus>("all");
  const [q, setQ] = useState("");
  const { data: payouts = [], isLoading } = usePayouts();
  const runs = payouts.map((p) => mapPayoutToRun(p));

  const rows = useMemo(
    () =>
      runs.filter((r) => {
        if (filter !== "all" && r.status !== filter) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          r.id.toLowerCase().includes(s) ||
          r.payoutId.toLowerCase().includes(s) ||
          r.reason.toLowerCase().includes(s)
        );
      }),
    [runs, filter, q],
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-6">
        <div className="section-marker">reconciliations</div>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <label className="flex min-w-0 items-center gap-2 border border-rule bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search run id, payout, reason…"
            className="w-full min-w-0 bg-transparent font-tabular text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <div className="flex shrink-0 border border-rule bg-card">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2 font-tabular text-[0.68rem] uppercase tracking-widest transition-colors ${
                filter === f.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ledger-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule">
              <th className="section-marker px-4 py-2 text-left">payout date</th>
              <th className="section-marker px-3 py-2 text-left">payout</th>
              <th className="section-marker px-3 py-2 text-left">issue</th>
              <th className="section-marker px-3 py-2 text-right">orders</th>
              <th className="section-marker px-3 py-2 text-right">gross</th>
              <th className="section-marker px-3 py-2 text-right">net</th>
              <th className="section-marker px-3 py-2 text-right">Δ</th>
              <th className="section-marker px-3 py-2 text-left">status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading payouts…
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-rule/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-tabular text-xs">{runLabel(r)}</td>
                <td className="px-3 py-3 font-tabular text-xs">{r.payoutId}</td>

                <td className="px-3 py-3">
                  {r.status === "flagged" ? (
                    <span className="inline-flex items-center border border-rule bg-muted/40 px-1.5 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                      review
                    </span>
                  ) : (
                    <span className="inline-flex items-center border border-success/40 bg-success/[0.06] px-1.5 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest text-success">
                      clean
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-tabular text-xs">{r.orders || "—"}</td>
                <td className="px-3 py-3 text-right font-tabular text-xs">{money(r.gross)}</td>
                <td className="px-3 py-3 text-right font-tabular text-xs">{money(r.net)}</td>
                <td
                  className={`px-3 py-3 text-right font-tabular text-xs ${
                    r.discrepancy < 0 ? "text-danger" : "text-muted-foreground"
                  }`}
                >
                  {r.discrepancy === 0 ? "—" : money(r.discrepancy)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center border px-1.5 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest ${
                      r.status === "flagged"
                        ? "border-danger/60 text-danger"
                        : r.status === "posted"
                          ? "border-accent/60 text-accent"
                          : "border-success/50 text-success"
                    }`}
                  >
                    {r.status}
                  </span>
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
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
