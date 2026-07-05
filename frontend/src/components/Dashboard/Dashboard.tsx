import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ChevronDown,
  LogOut,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BankFeed from './BankFeed';
import ExplainPane from '../ExplainPane/ExplainPane';
import { fetchBankTransactions, syncPayouts, getXeroAuthorizeUrl, fetchPayouts } from '@/services/api';
import type { BankTransaction, Payout } from '@/types';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Skeleton shimmer for sidebar / main content loading
// ---------------------------------------------------------------------------
function SkeletonBlock({
  w = '100%',
  h = 16,
  delay = 0,
}: {
  w?: string | number;
  h?: number;
  delay?: number;
}) {
  return (
    <div
      className="rounded-md bg-white/5 animate-pulse"
      style={{
        width: typeof w === 'number' ? w : w,
        height: h,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Stripe integration badge
// ---------------------------------------------------------------------------
function IntegrationBadge({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[11px] font-medium',
        connected
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          : 'bg-red-500/10 border-red-500/25 text-red-400'
      )}
    >
      {connected ? (
        <CheckCircle2 className="w-3 h-3 shrink-0" />
      ) : (
        <AlertCircle className="w-3 h-3 shrink-0" />
      )}
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bank account item in sidebar
// ---------------------------------------------------------------------------
interface BankAccount {
  id: string;
  name: string;
  institution: string;
  balance: number;
  currency: string;
}

const MOCK_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-1',
    name: 'Operating Account',
    institution: 'ANZ Business',
    balance: 142_850.4,
    currency: 'USD',
  },
  {
    id: 'acc-2',
    name: 'Stripe Settlement',
    institution: 'Stripe',
    balance: 8_723.12,
    currency: 'USD',
  },
  {
    id: 'acc-3',
    name: 'Tax Reserve',
    institution: 'Westpac',
    balance: 31_000.0,
    currency: 'USD',
  },
];

function BankAccountItem({
  account,
  selected,
  onClick,
}: {
  account: BankAccount;
  selected: boolean;
  onClick: () => void;
}) {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: account.currency,
    minimumFractionDigits: 2,
  }).format(account.balance);

  return (
    <motion.button
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left rounded-xl px-3 py-3 transition-all group',
        selected
          ? 'bg-xero-blue/12 border border-xero-blue/25'
          : 'border border-transparent hover:bg-xero-surface/70'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={clsx(
              'text-sm font-medium truncate',
              selected ? 'text-xero-blue' : 'text-slate-200 group-hover:text-white'
            )}
          >
            {account.name}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">{account.institution}</p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0 mt-0.5">
          {fmt}
        </span>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// User avatar menu
// ---------------------------------------------------------------------------
function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('auth_token');
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-xero-surface/60 border border-white/8 px-3 py-1.5 hover:bg-xero-surface transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-xero-blue/20 border border-xero-blue/30 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-xero-blue" />
        </div>
        <span className="text-xs font-medium text-slate-300">Account</span>
        <ChevronDown
          className={clsx(
            'w-3.5 h-3.5 text-slate-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-xero-navy border border-white/10 shadow-2xl shadow-black/50 overflow-hidden z-50"
          >
            <div className="px-3 py-2.5 border-b border-white/8">
              <p className="text-xs font-medium text-white">Admin User</p>
              <p className="text-[11px] text-slate-500 mt-0.5">admin@paytrace.ai</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick stats
// ---------------------------------------------------------------------------
function QuickStats({ transactions }: { transactions: BankTransaction[] }) {
  const unreconciled = transactions.filter(
    (t) => t.reconciliationStatus === 'unreconciled'
  );
  const inProgress = transactions.filter(
    (t) => t.reconciliationStatus === 'in_progress'
  );

  const totalUnreconciled = unreconciled.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalUnreconciled);

  return (
    <div className="space-y-2.5">
      <h3 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-600 mb-3">
        Quick Stats
      </h3>

      <div className="bg-xero-surface/50 rounded-xl p-3 border border-white/5">
        <p className="text-[11px] text-slate-500 mb-1">Unreconciled</p>
        <p className="text-2xl font-semibold text-white tabular-nums">
          {unreconciled.length}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{fmt} total</p>
      </div>

      <div className="bg-xero-blue/8 rounded-xl p-3 border border-xero-blue/15">
        <p className="text-[11px] text-xero-blue/70 mb-1">In Progress</p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-semibold text-xero-blue tabular-nums">
            {inProgress.length}
          </p>
          {inProgress.length > 0 && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-xero-blue"
            />
          )}
        </div>
        <p className="text-xs text-xero-blue/50 mt-0.5">AI analyzing now</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merge synced Stripe payouts into the bank feed
// ---------------------------------------------------------------------------
function mergeBankFeedWithPayouts(
  xeroTransactions: BankTransaction[],
  payouts: Payout[]
): BankTransaction[] {
  // Only show Xero rows already linked to a Stripe payout — skip unrelated demo data
  const linkedXero = xeroTransactions.filter((t) => t.payoutId !== null);

  const linkedPayoutIds = new Set(
    linkedXero.map((t) => t.payoutId).filter((id): id is string => id !== null)
  );

  const stripeRows: BankTransaction[] = payouts
    .filter((p) => !linkedPayoutIds.has(p.id))
    .map((p) => ({
      id: `stripe-${p.id}`,
      date: p.arrivalDate,
      amount: p.amount,
      currency: p.currency,
      description: `Stripe payout · ${p.stripePayoutId}`,
      status: 'unreconciled' as const,
      payoutId: p.id,
      reconciliationStatus:
        p.reconciliationStatus === 'failed' ? 'failed' : p.reconciliationStatus,
    }));

  return [...stripeRows, ...linkedXero].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    MOCK_ACCOUNTS[0].id
  );
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch bank transactions (Xero) and synced Stripe payouts
  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<BankTransaction[]>({
    queryKey: ['bankTransactions'],
    queryFn: fetchBankTransactions,
    retry: false,
  });

  const { data: payouts = [], refetch: refetchPayouts } = useQuery<Payout[]>({
    queryKey: ['payouts'],
    queryFn: () => fetchPayouts(),
  });

  const feedTransactions = useMemo(
    () => mergeBankFeedWithPayouts(transactions, payouts),
    [transactions, payouts]
  );

  const isXeroNotConnected =
    isError &&
    (error as { response?: { status?: number } })?.response?.status === 403;

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncPayouts();
      // Background sync on the API — allow time before refetching
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await Promise.all([refetch(), refetchPayouts()]);
    } catch {
      // Sync errors are silent for now
    } finally {
      setIsSyncing(false);
    }
  }, [refetch, refetchPayouts]);

  const handleConnectXero = useCallback(async () => {
    try {
      const url = await getXeroAuthorizeUrl();
      window.location.href = url;
    } catch {
      // 401/403 is handled by the axios interceptor (redirect to /login)
    }
  }, []);

  const handleExplain = useCallback((id: string) => {
    setSelectedPayoutId(id);
  }, []);

  const handleViewAudit = useCallback((id: string) => {
    setSelectedPayoutId(id);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-xero-dark overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Top Nav */}
      {/* ------------------------------------------------------------------ */}
      <nav className="h-14 shrink-0 bg-xero-navy border-b border-white/8 flex items-center px-5 gap-4 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-8 h-8 rounded-lg bg-xero-blue/15 border border-xero-blue/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-xero-blue" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            PayTrace AI
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/8" />

        {/* Integration badges */}
        <div className="flex items-center gap-2">
          <IntegrationBadge label="Xero" connected />
          <IntegrationBadge label="Stripe API" connected />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User menu */}
        <UserMenu />
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Body: Sidebar + Main */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-xero-navy border-r border-white/8 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Bank accounts */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                <h2 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-600">
                  Bank Accounts
                </h2>
              </div>

              <div className="space-y-1">
                {isLoading
                  ? [0, 60, 120].map((d) => (
                      <div key={d} className="rounded-xl p-3 border border-white/5 space-y-2">
                        <SkeletonBlock h={14} delay={d} />
                        <SkeletonBlock w="60%" h={10} delay={d + 30} />
                      </div>
                    ))
                  : MOCK_ACCOUNTS.map((account) => (
                      <BankAccountItem
                        key={account.id}
                        account={account}
                        selected={selectedAccountId === account.id}
                        onClick={() => setSelectedAccountId(account.id)}
                      />
                    ))}
              </div>
            </section>

            {/* Quick stats */}
            <section>
              {isLoading ? (
                <div className="space-y-2">
                  <SkeletonBlock h={10} w="50%" />
                  <SkeletonBlock h={72} />
                  <SkeletonBlock h={72} />
                </div>
              ) : (
                <QuickStats transactions={feedTransactions} />
              )}
            </section>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {isError && !isXeroNotConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-base font-medium text-white mb-1">
                Failed to load transactions
              </p>
              <p className="text-sm text-slate-500 mb-5">
                Could not reach the server. Please try again.
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-lg bg-xero-blue hover:bg-xero-blue/90 px-4 py-2 text-sm font-medium text-white transition-all"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col">
              {/* Header skeleton */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <SkeletonBlock w={80} h={12} />
                <SkeletonBlock w={70} h={30} />
              </div>
              {/* Row skeletons */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[90px_1fr_140px_160px_160px] gap-4 px-5 py-3.5 border-b border-white/5"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {[90, '100%', 140, 120, 120].map((w, j) => (
                    <div
                      key={j}
                      className="h-4 rounded-md bg-white/5 animate-pulse"
                      style={{
                        width: typeof w === 'number' ? w : w,
                        animationDelay: `${i * 60 + j * 20}ms`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex">
              {/* Bank feed (fills remaining space when pane is closed) */}
              <div
                className={clsx(
                  'flex-1 overflow-hidden flex flex-col transition-all duration-300',
                  selectedPayoutId ? 'min-w-0' : 'w-full'
                )}
              >
                {isXeroNotConnected ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/60">
                    <p className="text-sm">No Xero account connected.</p>
                    <button
                      type="button"
                      onClick={handleConnectXero}
                      className="px-4 py-2 rounded bg-xero-blue text-white text-sm hover:bg-xero-blue/80"
                    >
                      Connect Xero
                    </button>
                  </div>
                ) : (
                <BankFeed
                  transactions={feedTransactions}
                  onExplain={handleExplain}
                  onViewAudit={handleViewAudit}
                  onSync={handleSync}
                  isSyncing={isSyncing}
                />
                )}
              </div>

              {/* ExplainPane slide-in */}
              <AnimatePresence>
                {selectedPayoutId && (
                  <motion.div
                    key="explain-pane"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 440, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="shrink-0 border-l border-white/8 bg-xero-navy overflow-hidden flex flex-col"
                  >
                    <ExplainPane
                      payoutId={selectedPayoutId}
                      onClose={() => setSelectedPayoutId(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
