import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import type { ProposedAction } from '@/types';

interface ReconcileConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (auditNote: string) => void;
  proposedActions: ProposedAction[];
  isLoading: boolean;
}

function actionLabel(action: ProposedAction): string {
  switch (action.type) {
    case 'match_invoice':
      return action.description || 'Match Stripe charge to Xero invoice';
    case 'create_journal':
      return action.description || 'Create a reconciliation journal entry in Xero';
    case 'reconcile_bank':
      return action.description || 'Reconcile bank transaction in Xero';
    default:
      return action.description || String(action.type);
  }
}

export default function ReconcileConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  proposedActions,
  isLoading,
}: ReconcileConfirmModalProps) {
  const [auditNote, setAuditNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(auditNote.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={!isLoading ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1F36] shadow-2xl pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-white"
                >
                  Confirm Reconciliation
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* What will happen */}
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-300">
                    What will happen:
                  </p>
                  <ul className="space-y-2">
                    {proposedActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{actionLabel(action)}</span>
                      </li>
                    ))}
                    {proposedActions.length === 0 && (
                      <li className="text-sm text-gray-500">
                        No actions to perform — already reconciled.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Audit note */}
                <div>
                  <label
                    htmlFor="audit-note"
                    className="mb-1.5 block text-sm font-medium text-gray-300"
                  >
                    Add a note for the audit trail{' '}
                    <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="audit-note"
                    ref={textareaRef}
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    rows={3}
                    placeholder="e.g. Reviewed by Finance team, approved for Q3 close"
                    className="w-full rounded-lg border border-white/10 bg-[#0D1B2A] px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none outline-none focus:border-[#13B5EA]/50 focus:ring-1 focus:ring-[#13B5EA]/30 transition-colors"
                    disabled={isLoading}
                  />
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-900/20 border border-amber-500/20 px-3 py-2.5">
                  <span className="text-amber-400 text-sm">⚠</span>
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    This will create entries in your live Xero account. This action
                    cannot be automatically undone.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-6 pb-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#13B5EA] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13B5EA]/85 transition-colors disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reconciling…
                    </>
                  ) : (
                    'Confirm and Reconcile'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
