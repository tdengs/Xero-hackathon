import type { PayoutDetail, PayoutListItem, PayoutSummary, ReconciliationJob } from "./api-types";
import type {
  NextStep,
  ReconciliationRow,
  Run,
  RunStatus,
  StripeType,
} from "./reconciliation-data";

const ITEM_TYPE_MAP: Record<string, StripeType> = {
  payment: "gross",
  stripe_fee: "fee",
  refund: "refund",
  chargeback: "dispute",
  fx_adjustment: "fx",
  adjustment: "fee",
};

function currencyCode(code: string): "USD" | "NZD" {
  return code.toUpperCase() === "NZD" ? "NZD" : "USD";
}

function mapRunStatus(reconciliationStatus: string, job?: ReconciliationJob | null): RunStatus {
  if (reconciliationStatus === "reconciled") return "matched";
  if (job?.status === "approved") return "posted";
  if (
    job?.status === "completed" &&
    job.explanation?.balanced &&
    !job.explanation?.needsHumanReview
  ) {
    return "matched";
  }
  if (
    reconciliationStatus === "needs_review" ||
    job?.status === "needs_review" ||
    job?.explanation?.needsHumanReview ||
    (job?.status === "completed" && job.explanation && !job.explanation.balanced)
  ) {
    return "flagged";
  }
  if (reconciliationStatus === "unreconciled" && !job) return "matched";
  return reconciliationStatus === "in_progress" ? "flagged" : "matched";
}

function payeeFromDescription(description: string | null, type: string): string {
  if (!description) {
    return type === "stripe_fee" ? "Stripe, Inc." : "Unknown payee";
  }
  const parts = description.split("·").map((p) => p.trim());
  if (parts.length > 1) return parts[0];
  return description.slice(0, 40);
}

export function mapPayoutToRun(
  payout: PayoutListItem,
  summary?: PayoutSummary,
  job?: ReconciliationJob | null,
): Run {
  const gross = summary?.grossSales ?? payout.amount;
  const net = summary?.netPayout ?? payout.amount;
  const orders = summary?.paymentCount ?? 0;
  const discrepancy = summary
    ? net - (gross + (summary.stripeFees ?? 0) + (summary.refunds ?? 0) + (summary.chargebacks ?? 0) + (summary.fxAdjustments ?? 0))
    : 0;

  const status = mapRunStatus(payout.reconciliationStatus, job);
  const reason =
    job?.explanation?.summary ??
    (status === "matched"
      ? "Payout reconciles cleanly against Xero"
      : payout.reconciliationStatus === "needs_review"
        ? "Agent flagged items that need review"
        : "Awaiting agent reconciliation");

  return {
    id: payout.id,
    date: payout.arrivalDate,
    payoutId: payout.stripePayoutId,
    currency: currencyCode(payout.currency),
    gross,
    net,
    orders,
    discrepancy: Math.abs(discrepancy) < 0.02 ? 0 : Math.round(discrepancy * 100) / 100,
    status,
    reason,
    confidence: job?.explanation?.needsHumanReview ? 0.88 : status === "matched" ? 0.99 : 0.91,
  };
}

export function mapPayoutDetailToRows(
  payout: PayoutDetail,
  job?: ReconciliationJob | null,
): ReconciliationRow[] {
  const evidence = job?.explanation?.evidence ?? [];

  return payout.items.map((item) => {
    const stripeType = ITEM_TYPE_MAP[item.type] ?? "gross";
    const xeroRef = item.xeroInvoiceNumber ?? item.xeroInvoiceId ?? null;
    const matchedEvidence = evidence.find(
      (e) =>
        e.evidenceType.includes("xero") &&
        e.amount != null &&
        Math.abs(e.amount - item.amount) < 0.02,
    );

    const xero =
      xeroRef || matchedEvidence
        ? {
            ref: xeroRef ?? matchedEvidence!.evidenceId,
            label: matchedEvidence?.claim ?? `Matched in Xero`,
            type: "invoice" as const,
            amount: item.amount,
            confidence: 0.94,
          }
        : null;

    const proposed = job?.explanation?.proposedActions?.find((a) =>
      a.description.toLowerCase().includes(String(Math.abs(item.amount))),
    );

    return {
      stripe: {
        date: payout.arrivalDate,
        payee: payeeFromDescription(item.description, item.type),
        label: item.description ?? item.stripeBalanceTransactionId,
        amount: item.amount,
        type: stripeType,
      },
      xero,
      suggestion: !xero && proposed
        ? {
            type: "journal" as const,
            label: proposed.description,
          }
        : undefined,
    };
  });
}

export function mapProposedActionsToNextSteps(
  job: ReconciliationJob | null | undefined,
): NextStep[] {
  const actions = job?.explanation?.proposedActions ?? [];
  if (actions.length === 0 && job?.explanation?.summary) {
    return [
      {
        kind: "one-off",
        label: "Review agent summary",
        detail: job.explanation.summary,
      },
    ];
  }

  return actions.map((action) => ({
    kind:
      action.action === "flag_for_review"
        ? ("monitor" as const)
        : action.action === "create_journal_entry"
          ? ("rule" as const)
          : ("one-off" as const),
    label: action.action.replace(/_/g, " "),
    detail: action.description,
  }));
}

export function isJobPending(job: ReconciliationJob | null | undefined): boolean {
  return job?.status === "queued" || job?.status === "running";
}
