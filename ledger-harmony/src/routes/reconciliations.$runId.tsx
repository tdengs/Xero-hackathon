import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { runLabel } from "@/lib/reconciliation-data";
import {
  isJobPending,
  mapPayoutDetailToRows,
  mapPayoutToRun,
  mapProposedActionsToNextSteps,
} from "@/lib/map-payout";
import {
  approveJob,
  explainPayout,
  jobKeys,
  payoutKeys,
  usePayout,
  usePayoutSummary,
  useReconciliationJob,
} from "@/lib/queries";
import { PayoutVsXero } from "@/components/reconciliation/PayoutVsXero";
import { NextSteps } from "@/components/reconciliation/NextSteps";

export const Route = createFileRoute("/reconciliations/$runId")({
  component: RunDetail,
  notFoundComponent: RunNotFound,
});

function money(n: number) {
  const s = n < 0 ? "−" : "";
  return `${s}$${Math.abs(n).toFixed(2)}`;
}

function MatchedActions() {
  return (
    <div className="ledger-card">
      <div className="border-b border-rule px-5 py-3">
        <div className="section-marker">suggested actions</div>
      </div>
      <div className="px-5 py-6 text-center font-tabular text-[0.85rem] text-muted-foreground">
        none — payout is fully reconciled.
      </div>
    </div>
  );
}

function RunDetail() {
  const { runId } = Route.useParams();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);

  const payoutQuery = usePayout(runId);
  const summaryQuery = usePayoutSummary(runId);
  const jobQuery = useReconciliationJob(jobId);

  useEffect(() => {
    if (payoutQuery.data?.jobId && !jobId) {
      setJobId(payoutQuery.data.jobId);
    }
  }, [payoutQuery.data?.jobId, jobId]);

  const explainMutation = useMutation({
    mutationFn: () => explainPayout(runId),
    onSuccess: (data) => {
      setJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(runId) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveJob(jobId!),
    onSuccess: (data) => {
      setApproveMessage(data.message);
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId!) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(runId) });
    },
  });

  if (payoutQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payout…
      </div>
    );
  }

  if (payoutQuery.error || !payoutQuery.data) {
    throw notFound();
  }

  const payout = payoutQuery.data;
  const job = jobQuery.data;
  const run = mapPayoutToRun(
    {
      id: payout.id,
      stripePayoutId: payout.stripePayoutId,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrivalDate: payout.arrivalDate,
      reconciliationStatus: payout.reconciliationStatus,
    },
    summaryQuery.data,
    job,
  );
  const rows = mapPayoutDetailToRows(payout, job);
  const steps = mapProposedActionsToNextSteps(job);
  const isFlagged = run.status === "flagged";
  const currency = run.currency;
  const pending = isJobPending(job);

  const net = summaryQuery.data?.netPayout ?? payout.amount;

  const showAnalyzeBanner = useMemo(() => {
    if (!payout.jobId && !jobId && !explainMutation.isPending) return true;
    if (job?.status === "failed") return true;
    return false;
  }, [payout.jobId, jobId, explainMutation.isPending, job?.status]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <Link
        to="/reconciliations"
        className="mb-4 inline-flex items-center gap-1 font-tabular text-[0.7rem] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> all payouts
      </Link>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="section-marker mb-1">stripe payout</div>
          <h1 className="truncate font-tabular text-3xl leading-tight sm:text-4xl">
            {runLabel(run)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-tabular">{run.payoutId}</span>
            {summaryQuery.data?.paymentCount ? (
              <>
                {" "}
                · {summaryQuery.data.paymentCount} orders · gross{" "}
                <span className="font-tabular">{money(run.gross)}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`inline-flex items-center border px-2 py-1 font-tabular text-[0.65rem] uppercase tracking-widest ${
              isFlagged
                ? "border-danger/60 text-danger"
                : "border-success/50 text-success"
            }`}
          >
            {run.status}
          </span>
          <div className="mt-2 font-tabular text-[0.72rem] text-muted-foreground">
            confidence {Math.round(run.confidence * 100)}%
          </div>
        </div>
      </div>

      {showAnalyzeBanner ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-rule bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Run the agent to match Stripe lines against Xero and propose corrections.
          </p>
          <button
            onClick={() => explainMutation.mutate()}
            disabled={explainMutation.isPending}
            className="inline-flex items-center gap-2 border border-accent bg-accent px-3 py-2 font-tabular text-[0.68rem] uppercase tracking-widest text-accent-foreground disabled:opacity-60"
          >
            {explainMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> queuing…
              </>
            ) : (
              "run agent"
            )}
          </button>
        </div>
      ) : null}

      {pending ? (
        <div className="mb-6 flex items-center gap-2 border border-accent/40 bg-accent/[0.06] px-4 py-3 font-tabular text-[0.82rem] text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          Agent is analyzing this payout ({job?.status ?? "queued"})…
        </div>
      ) : null}

      {job?.errorMessage ? (
        <div className="mb-6 border border-danger/50 bg-danger/[0.06] px-4 py-3 text-sm text-danger">
          {job.errorMessage}
        </div>
      ) : null}

      <section className="mb-10">
        <div className="section-marker mb-3">§ 01 · payout vs Xero</div>
        <PayoutVsXero
          payoutId={run.payoutId}
          currency={currency}
          rows={rows}
          net={net}
        />
      </section>

      <section className="mb-10">
        <div className="section-marker mb-3">§ 02 · suggested actions</div>
        {isFlagged && steps.length > 0 ? (
          <NextSteps
            steps={steps}
            onApprove={jobId ? () => approveMutation.mutate() : undefined}
            approving={approveMutation.isPending}
            approveMessage={approveMessage}
          />
        ) : isFlagged && pending ? (
          <div className="ledger-card px-5 py-6 text-center font-tabular text-[0.85rem] text-muted-foreground">
            Actions will appear when the agent finishes analysis.
          </div>
        ) : (
          <MatchedActions />
        )}
      </section>
    </div>
  );
}

function RunNotFound() {
  const { runId } = Route.useParams();
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <div className="section-marker mb-2">404 · run</div>
      <h1 className="text-3xl">No reconciliation matches “{runId}”.</h1>
      <Link
        to="/reconciliations"
        className="mt-6 inline-flex items-center gap-1 border border-accent bg-accent px-3 py-2 font-tabular text-[0.7rem] uppercase tracking-widest text-accent-foreground"
      >
        back to all runs
      </Link>
    </div>
  );
}
