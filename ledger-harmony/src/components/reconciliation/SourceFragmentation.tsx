import { issueContent, type IssueKind } from "@/lib/reconciliation-data";

function money(n: number, currency: "USD" | "NZD" = "USD") {
  const sign = n < 0 ? "−" : "";
  const symbol = currency === "USD" ? "$" : "NZ$";
  return `${sign}${symbol}${Math.abs(n).toFixed(2)}`;
}

type CardProps = {
  source: string;
  meta: string;
  tint: "stripe" | "xero";
  children: React.ReactNode;
};

function LedgerCard({ source, meta, tint, children }: CardProps) {
  const tintClass = tint === "stripe" ? "bg-tint-stripe" : "bg-tint-xero";
  return (
    <div className="ledger-card flex flex-col">
      <div className={`${tintClass} border-b border-rule px-4 py-3`}>
        <div className="font-tabular text-[0.7rem] uppercase tracking-[0.14em] text-foreground/80">
          {source}
        </div>
        <div className="font-tabular text-[0.7rem] text-foreground/50">{meta}</div>
      </div>
      <div className="flex-1 px-4 py-4">{children}</div>
    </div>
  );
}

function Row({
  left,
  right,
  status,
  danger,
}: {
  left: string;
  right: string;
  status?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-dashed border-rule/70 py-2.5 last:border-b-0 ${
        danger ? "text-danger" : ""
      }`}
    >
      <span className="font-tabular text-sm">{left}</span>
      <div className="flex items-center gap-3">
        <span className="font-tabular text-sm">{right}</span>
        {status ? (
          <span
            className={`font-tabular text-[0.62rem] uppercase tracking-widest ${
              danger
                ? "border border-danger/60 px-1.5 py-0.5 text-danger"
                : "border border-success/50 px-1.5 py-0.5 text-success"
            }`}
          >
            {status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SourceFragmentation({
  issue = "refund-timing",
}: {
  issue?: IssueKind;
}) {
  const c = issueContent[issue];
  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LedgerCard source="Stripe" meta="payout · net" tint="stripe">
          {c.payoutLines.map((l) => (
            <Row key={l.label} left={l.label} right={money(l.amount, c.payoutCurrency)} />
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-rule pt-3">
            <span className="font-tabular text-xs uppercase tracking-widest text-foreground/70">
              net deposited
            </span>
            <span className="font-tabular text-sm">
              {money(c.payoutNet, c.payoutCurrency)}
            </span>
          </div>
        </LedgerCard>

        <LedgerCard source="Xero" meta="bank feed" tint="xero">
          <Row
            left={c.xeroTxn.label}
            right={money(c.xeroTxn.amount, c.xeroTxn.currency)}
            status={c.xeroTxn.status}
            danger
          />
          <div className="mt-3 font-tabular text-[0.72rem] leading-relaxed text-danger/90">
            no matching invoice — awaits reconciliation.
          </div>
        </LedgerCard>
      </div>

      <div className="mt-6 flex justify-center">
        <svg viewBox="0 0 600 140" className="h-32 w-full max-w-3xl text-rule" aria-hidden>
          <path
            d="M150 10 Q 150 80, 300 130"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
          <path
            d="M450 10 Q 450 80, 300 130"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
          <circle cx="300" cy="130" r="4" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
