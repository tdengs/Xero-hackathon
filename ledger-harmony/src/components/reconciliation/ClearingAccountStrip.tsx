import { useEffect, useState } from "react";
import { issueContent, type IssueKind } from "@/lib/reconciliation-data";

function money(n: number, currency: "USD" | "NZD" = "USD") {
  const sign = n < 0 ? "−" : "";
  const symbol = currency === "USD" ? "$" : "NZ$";
  return `${sign}${symbol}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ClearingAccountStrip({
  issue,
  posted = false,
}: {
  issue: IssueKind;
  posted?: boolean;
}) {
  const c = issueContent[issue];
  const [animated, setAnimated] = useState(posted);

  useEffect(() => {
    if (posted) {
      const t = setTimeout(() => setAnimated(true), 60);
      return () => clearTimeout(t);
    }
    setAnimated(false);
  }, [posted]);

  const clearingNow = animated ? c.stripeBalance : c.clearingBefore;
  const delta = clearingNow - c.stripeBalance;
  const inSync = Math.abs(delta) < 0.005;

  return (
    <div className="ledger-card">
      <div className="flex items-center justify-between border-b border-rule px-5 py-2.5">
        <div className="section-marker">clearing invariant</div>
        <div className="font-tabular text-[0.62rem] uppercase tracking-widest text-muted-foreground">
          Stripe Clearing must equal Stripe balance
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="border-b border-rule px-5 py-4 md:border-b-0 md:border-r">
          <div className="section-marker mb-1">Stripe balance</div>
          <div className="font-tabular text-2xl">
            {money(c.stripeBalance, c.clearingCurrency)}
          </div>
          <div className="mt-1 font-tabular text-[0.7rem] text-muted-foreground">
            per Stripe Dashboard
          </div>
        </div>

        <div className="hidden items-center justify-center px-2 md:flex">
          <span className="font-tabular text-xl text-muted-foreground">═</span>
        </div>

        <div className="border-b border-rule px-5 py-4 md:border-b-0 md:border-r">
          <div className="section-marker mb-1">Stripe Clearing (Xero)</div>
          <div
            className={`font-tabular text-2xl transition-colors duration-500 ${
              inSync ? "text-success" : "text-foreground"
            }`}
          >
            {money(clearingNow, c.clearingCurrency)}
          </div>
          <div className="mt-1 font-tabular text-[0.7rem] text-muted-foreground">
            {posted ? "after posting journal" : "before posting journal"}
          </div>
        </div>

        <div className="hidden items-center justify-center px-2 md:flex">
          <span className="font-tabular text-xl text-muted-foreground">→</span>
        </div>

        <div className="px-5 py-4">
          <div className="section-marker mb-1">Δ</div>
          <div
            className={`font-tabular text-2xl transition-colors duration-500 ${
              inSync ? "text-success" : "text-danger"
            }`}
          >
            {inSync ? money(0, c.clearingCurrency) : money(delta, c.clearingCurrency)}
          </div>
          <div
            className={`mt-1 font-tabular text-[0.7rem] uppercase tracking-widest transition-colors duration-500 ${
              inSync ? "text-success" : "text-danger"
            }`}
          >
            {inSync ? "in sync" : "out of sync"}
          </div>
        </div>
      </div>
    </div>
  );
}
