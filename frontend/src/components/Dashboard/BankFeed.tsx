import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Sparkles,
  Loader2,
  FileText,
  Inbox,
  Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { BankTransaction } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BankFeedProps {
  transactions: BankTransaction[];
  onExplain: (id: string) => void;
  onViewAudit: (id: string) => void;
  onSync: () => void | Promise<void>;
  isSyncing: boolean;
}

// ---------------------------------------------------------------------------
// Stripe "S" logo — inline SVG mini icon
// ---------------------------------------------------------------------------
function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        className="text-[#635BFF]"
        fill="currentColor"
        aria-label="Stripe"
        role="img"
      >
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 23.125 7.985 24 11.692 24c2.586 0 4.764-.654 6.277-1.94 1.624-1.372 2.476-3.348 2.476-5.735-.003-4.101-2.522-5.843-6.469-7.175z" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: BankTransaction['reconciliationStatus'] }) {
  if (status === 'reconciled' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        Reconciled
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 border border-red-500/25 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
        Failed
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-xero-blue/12 border border-xero-blue/25 px-2.5 py-0.5 text-[11px] font-medium text-xero-blue">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-xero-blue shrink-0"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        In Progress
      </span>
    );
  }
  // unreconciled
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/12 border border-slate-500/20 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
      Unreconciled
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------
function ActionButton({
  transaction,
  onExplain,
  onViewAudit,
}: {
  transaction: BankTransaction;
  onExplain: (id: string) => void;
  onViewAudit: (id: string) => void;
}) {
  const { reconciliationStatus, payoutId, id } = transaction;
  const isStripePayout = payoutId !== null;

  if (reconciliationStatus === 'in_progress') {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg bg-xero-blue/10 border border-xero-blue/20 px-3 py-1.5 text-xs font-medium text-xero-blue/60 cursor-not-allowed"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Analyzing...
      </button>
    );
  }

  if ((reconciliationStatus === 'reconciled' || reconciliationStatus === 'approved') && isStripePayout) {
    return (
      <button
        onClick={() => onViewAudit(id)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-xero-blue transition-colors py-1.5 px-1"
      >
        <FileText className="w-3.5 h-3.5" />
        View audit trail
      </button>
    );
  }

  if (reconciliationStatus === 'unreconciled' && isStripePayout) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onExplain(payoutId!)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-xero-blue hover:bg-xero-blue/90 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-xero-blue/20 transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Explain with AI
      </motion.button>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------
function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="grid grid-cols-[90px_1fr_140px_160px_160px] gap-4 px-5 py-3.5 border-b border-white/5"
    >
      {[90, '100%', 140, 120, 120].map((w, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-white/5 animate-pulse"
          style={typeof w === 'number' ? { width: w } : { width: w }}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-xero-navy border border-white/8 flex items-center justify-center mb-4">
        <Inbox className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-base font-medium text-white mb-1">Loading transactions…</p>
      <p className="text-sm text-slate-500">
        Fetching your Stripe payouts. This may take a moment.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction Row
// ---------------------------------------------------------------------------
function TransactionRow({
  tx,
  index,
  onExplain,
  onViewAudit,
}: {
  tx: BankTransaction;
  index: number;
  onExplain: (id: string) => void;
  onViewAudit: (id: string) => void;
}) {
  const isStripePayout = tx.payoutId !== null;
  const formattedDate = format(parseISO(tx.date), 'MMM d');
  const isNegative = tx.amount < 0;
  const absAmount = Math.abs(tx.amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(absAmount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'group relative grid grid-cols-[90px_1fr_140px_160px_160px] gap-4 items-center px-5 py-3.5',
        'border-b border-white/5 hover:bg-xero-surface/50 transition-colors duration-150',
        isStripePayout && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-xero-blue before:rounded-r'
      )}
    >
      {/* Date */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar className="w-3 h-3 shrink-0" />
        {formattedDate}
      </div>

      {/* Description */}
      <div className="flex items-center gap-2 min-w-0">
        {isStripePayout && <StripeBadge />}
        <span className="text-sm text-slate-200 truncate" title={tx.description}>
          {tx.description}
        </span>
      </div>

      {/* Amount */}
      <div
        className={clsx(
          'text-sm font-mono tabular-nums text-right',
          isNegative ? 'text-red-400' : 'text-emerald-400'
        )}
      >
        {isNegative ? `−${formatted}` : formatted}
      </div>

      {/* Status badge */}
      <div className="flex justify-center">
        <StatusBadge status={tx.reconciliationStatus} />
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <ActionButton transaction={tx} onExplain={onExplain} onViewAudit={onViewAudit} />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// BankFeed
// ---------------------------------------------------------------------------
export default function BankFeed({
  transactions,
  onExplain,
  onViewAudit,
  onSync,
  isSyncing,
}: BankFeedProps) {
  // Derive date range label
  const dateRangeLabel = (() => {
    if (transactions.length === 0) return 'No data';
    const sorted = [...transactions].sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    const first = format(parseISO(sorted[0].date), 'MMM d');
    const last = format(parseISO(sorted[sorted.length - 1].date), 'MMM d, yyyy');
    return `${first} – ${last}`;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
            Bank Feed
          </span>
          <span className="text-xs text-slate-600">{dateRangeLabel}</span>
        </div>
        <button
          onClick={() => onSync()}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-xero-blue hover:bg-xero-blue/90 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-xero-blue/20 transition-all"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Sync Payouts'}
        </button>
      </div>

      {/* Column headers */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-[90px_1fr_140px_160px_160px] gap-4 px-5 py-2.5 border-b border-white/5 shrink-0">
          {['Date', 'Description', 'Amount', 'Status', 'Action'].map((h, i) => (
            <div
              key={h}
              className={clsx(
                'text-[10px] font-semibold tracking-widest uppercase text-slate-600',
                i === 2 && 'text-right',
                i === 3 && 'text-center',
                i === 4 && 'text-right'
              )}
            >
              {h}
            </div>
          ))}
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {transactions.length === 0 ? (
            isSyncing ? (
              <div>
                {[0, 1, 2, 3, 4].map((i) => (
                  <SkeletonRow key={i} delay={i * 0.05} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )
          ) : (
            transactions.map((tx, i) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                index={i}
                onExplain={onExplain}
                onViewAudit={onViewAudit}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
