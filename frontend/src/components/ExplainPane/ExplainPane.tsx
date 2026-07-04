import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Loader2,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useReconciliationJob,
  useExplainPayout,
  useApproveReconciliation,
} from '@/hooks/useReconciliation';
import AnomalyAlert from './AnomalyAlert';
import BreakdownTable from './BreakdownTable';
import ReconcileConfirmModal from './ReconcileConfirmModal';

interface ExplainPaneProps {
  payoutId: string | null;
  onClose: () => void;
}

const PROGRESS_STEPS = [
  { key: 'fetch', label: 'Fetching Stripe transactions…' },
  { key: 'xero', label: 'Searching Xero invoices…' },
  { key: 'reconcile', label: 'Calculating reconciliation…' },
];

function statusToStep(status: string): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'running':
      return 1;
    case 'completed':
    case 'approved':
      return 3;
    default:
      return 0;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ExplainPane({ payoutId, onClose }: ExplainPaneProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const { mutateAsync: startExplain, isLoading: isStarting } = useExplainPayout();
  const { data: job } = useReconciliationJob(jobId);
  const { mutateAsync: approveJob, isPending: isApproving } = useApproveReconciliation();

  // Kick off the job whenever payoutId changes
  useEffect(() => {
    if (!payoutId) {
      setJobId(null);
      setExplainError(null);
      return;
    }

    setJobId(null);
    setExplainError(null);

    startExplain(payoutId)
      .then(({ jobId: id }) => setJobId(id))
      .catch((err: Error) => setExplainError(err.message ?? 'Failed to start analysis.'));
  }, [payoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepsDone = job ? statusToStep(job.status) : isStarting ? 0 : 0;

  const handleRowClick = (_name: string) => {
    // Evidence drawer is handled inside BreakdownTable
  };

  const handleConfirmReconcile = async (auditNote: string) => {
    if (!jobId) return;
    await approveJob({ jobId, auditNote });
    setShowModal(false);
  };

  // Derive payout date from job if available, else today as fallback
  const payoutDate = job?.createdAt
    ? format(new Date(job.createdAt), 'MMM d, yyyy')
    : payoutId
    ? 'Loading…'
    : '';

  const isLoading =
    isStarting ||
    (!!jobId && !!job && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'approved');
  const isComplete = job?.status === 'completed' || job?.status === 'approved';
  const isFailed = job?.status === 'failed';
  const explanation = job?.explanation ?? null;

  return (
    <AnimatePresence>
      {payoutId && (
        <motion.div
          key="explain-pane"
          initial={{ x: 480, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 480, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed right-0 top-0 bottom-0 z-40 flex flex-col w-[480px] border-l border-white/5 bg-[#0D1B2A] shadow-2xl"
        >
          {/* Inner scroll area */}
          <div className="flex flex-col h-full overflow-hidden">
            {/* ---- LOADING STATE ---- */}
            {(isLoading || isStarting) && !isFailed && !isComplete && (
              <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
                <Loader2 className="w-8 h-8 text-[#13B5EA] animate-spin" />
                <div className="w-full space-y-3">
                  {PROGRESS_STEPS.map((step, idx) => {
                    const done = idx < stepsDone;
                    const active = idx === stepsDone;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : active ? (
                          <Loader2 className="w-5 h-5 text-[#13B5EA] animate-spin flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            done
                              ? 'text-emerald-400'
                              : active
                              ? 'text-white'
                              : 'text-gray-500'
                          }`}
                        >
                          {done
                            ? step.label.replace('…', '')
                            : step.label}
                          {done && (
                            <span className="ml-2 text-xs text-emerald-400/70">
                              Done
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- ERROR STATE ---- */}
            {(isFailed || explainError) && (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-full rounded-xl border border-red-500/30 bg-red-900/20 p-5 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <p className="text-sm text-red-300 font-medium mb-1">
                    Analysis failed
                  </p>
                  <p className="text-xs text-red-300/70">
                    {explainError ?? 'The reconciliation job encountered an error. Please try again.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setExplainError(null);
                      setJobId(null);
                      if (payoutId) {
                        startExplain(payoutId)
                          .then(({ jobId: id }) => setJobId(id))
                          .catch((err: Error) =>
                            setExplainError(err.message ?? 'Failed to start analysis.')
                          );
                      }
                    }}
                    className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* ---- COMPLETE STATE ---- */}
            {isComplete && explanation && (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                      Stripe Payout
                    </p>
                    <p className="text-base font-medium text-white">{payoutDate}</p>
                    <p className="text-3xl font-mono font-bold text-white mt-1">
                      {formatCurrency(explanation.netPayout)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {/* AI Summary card */}
                  <div className="relative rounded-xl border border-white/5 bg-[#1A1F36] overflow-hidden">
                    {/* Gradient left border */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#13B5EA] to-[#1A1F36]" />
                    <div className="flex items-start gap-3 px-4 py-3 pl-5">
                      <Sparkles className="w-4 h-4 text-[#13B5EA] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {explanation.summary}
                      </p>
                    </div>
                  </div>

                  {/* Anomaly alerts */}
                  {explanation.anomalies.length > 0 && (
                    <div className="space-y-2">
                      {explanation.anomalies.map((anomaly, i) => (
                        <AnomalyAlert key={i} anomaly={anomaly} />
                      ))}
                    </div>
                  )}

                  {/* Breakdown table */}
                  <BreakdownTable
                    explanation={explanation}
                    onRowClick={handleRowClick}
                  />
                </div>

                {/* Footer CTA */}
                <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="w-full rounded-xl bg-[#13B5EA] py-3 text-sm font-semibold text-white hover:bg-[#13B5EA]/85 transition-colors"
                  >
                    Reconcile Everything
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Reconcile confirm modal */}
          <ReconcileConfirmModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onConfirm={handleConfirmReconcile}
            proposedActions={explanation?.proposedActions ?? []}
            isLoading={isApproving}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
