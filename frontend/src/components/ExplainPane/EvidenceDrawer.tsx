import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ExternalLink, Link2 } from 'lucide-react';
import type { ReconciliationEvidence } from '@/types';

interface EvidenceDrawerProps {
  evidenceType: string;
  items: ReconciliationEvidence[];
  isOpen: boolean;
  onClose: () => void;
}

const sourceLabel: Record<string, string> = {
  stripe_charge: 'Stripe API',
  stripe_payout: 'Stripe API',
  xero_invoice: 'Xero Invoice',
  xero_journal: 'Xero Journal',
  bank_transaction: 'Bank Feed',
};

const typeIcon: Record<string, string> = {
  stripe_charge: '💳',
  stripe_payout: '📤',
  xero_invoice: '📄',
  xero_journal: '📒',
  bank_transaction: '🏦',
};

function truncateId(id: string, max = 20): string {
  if (id.length <= max) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

export default function EvidenceDrawer({
  evidenceType,
  items,
  isOpen,
  onClose,
}: EvidenceDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const source = sourceLabel[evidenceType] ?? evidenceType;
  const isStripe = source === 'Stripe API';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="evidence-drawer"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="mt-1 rounded-lg border border-[#13B5EA]/20 bg-[#0D1B2A] p-4">
            {/* Source badge */}
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#13B5EA]/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest text-[#13B5EA]">
                <Link2 className="w-3 h-3" />
                Source: {source}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Collapse
              </button>
            </div>

            {/* Evidence list */}
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-md bg-[#1A1F36] px-3 py-2"
                >
                  <span className="text-base leading-none">
                    {typeIcon[item.evidenceType] ?? '📎'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 font-mono truncate">
                      {truncateId(item.evidenceId)}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{item.claim}</p>
                  </div>
                  <span className="text-sm font-mono text-gray-200 whitespace-nowrap">
                    {formatAmount(item.amount)}
                  </span>
                  {item.verified && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  {item.evidenceUrl && (
                    <a
                      href={item.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#13B5EA] hover:text-[#13B5EA]/70 transition-colors"
                      title={isStripe ? 'View in Stripe' : 'View in Xero'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  No evidence records found.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-gray-400">
                Total: {items.length} transaction{items.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {formatAmount(total)} Verified
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
