import { Check } from "lucide-react";
import { issueContent, type IssueKind, type JournalLine } from "@/lib/reconciliation-data";

function money(n?: number, currency: "USD" | "NZD" = "USD") {
  if (n === undefined) return "";
  const symbol = currency === "USD" ? "$" : "NZ$";
  return `${symbol}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function totals(lines: JournalLine[]) {
  const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
}

export function WriteBackConfirmation({
  issue = "refund-timing",
  posted = false,
  onPost,
}: {
  issue?: IssueKind;
  posted?: boolean;
  onPost?: () => void;
}) {
  const c = issueContent[issue];
  const t = totals(c.journal);

  return (
    <div className="ledger-card">
      <div className="flex items-center justify-between border-b border-rule bg-tint-xero px-5 py-3">
        <div className="font-tabular text-[0.7rem] uppercase tracking-[0.14em]">
          {c.writeBackTitle}
        </div>
        <div className="font-tabular text-[0.62rem] uppercase tracking-widest text-muted-foreground">
          {c.journalCurrency}
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-rule pb-2">
          <div className="section-marker">account</div>
          <div className="section-marker text-right">debit</div>
          <div className="section-marker text-right">credit</div>
        </div>

        <div className="mb-3 divide-y divide-rule/60">
          {c.journal.map((line, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] items-start gap-x-6 py-2.5"
            >
              <div className="min-w-0">
                <div className="font-tabular text-sm">{line.account}</div>
                {line.memo ? (
                  <div className="mt-0.5 font-tabular text-[0.72rem] text-muted-foreground">
                    {line.memo}
                  </div>
                ) : null}
              </div>
              <div className="text-right font-tabular text-sm tabular-nums">
                {line.debit ? money(line.debit, c.journalCurrency) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </div>
              <div className="text-right font-tabular text-sm tabular-nums">
                {line.credit ? money(line.credit, c.journalCurrency) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-[1fr_auto_auto] gap-x-6 border-t-2 border-foreground pt-2">
          <div className="font-tabular text-[0.7rem] uppercase tracking-widest">
            totals · {t.balanced ? "balanced" : "unbalanced"}
          </div>
          <div className="text-right font-tabular text-sm tabular-nums">
            {money(t.debit, c.journalCurrency)}
          </div>
          <div className="text-right font-tabular text-sm tabular-nums">
            {money(t.credit, c.journalCurrency)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onPost}
            disabled={posted}
            className={`font-tabular text-xs uppercase tracking-[0.16em] px-5 py-3 transition-all duration-300 ${
              posted
                ? "bg-success text-primary-foreground cursor-default"
                : "bg-accent text-accent-foreground shadow-[0_4px_0_0_rgba(28,43,42,0.15)] hover:translate-y-[1px] hover:shadow-[0_3px_0_0_rgba(28,43,42,0.15)]"
            }`}
          >
            {posted ? (
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5" /> posted to Xero
              </span>
            ) : (
              "post journal to Xero"
            )}
          </button>
          <button
            disabled={posted}
            className="border border-rule bg-card px-4 py-3 font-tabular text-xs uppercase tracking-[0.16em] text-foreground hover:bg-muted disabled:opacity-50"
          >
            save mapping as rule
          </button>
        </div>
      </div>
    </div>
  );
}
