export interface Payout {
  id: string;
  stripePayoutId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';
  arrivalDate: string;
  description: string | null;
  reconciliationStatus: 'unreconciled' | 'in_progress' | 'reconciled' | 'approved' | 'failed';
}

export interface PayoutItem {
  id: string;
  payoutId: string;
  type: 'charge' | 'refund' | 'chargeback' | 'fee' | 'adjustment';
  amount: number;
  currency: string;
  description: string | null;
  stripeChargeId: string | null;
  xeroInvoiceId: string | null;
  xeroInvoiceNumber: string | null;
  matchedAt: string | null;
}

export interface Anomaly {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  relatedItemId: string | null;
}

export interface ProposedAction {
  type: 'match_invoice' | 'create_journal' | 'reconcile_bank';
  description: string;
  params: Record<string, unknown>;
}

export interface ReconciliationEvidence {
  id: string;
  claim: string;
  evidenceType: 'stripe_charge' | 'xero_invoice' | 'xero_journal' | 'bank_transaction' | 'stripe_payout';
  evidenceId: string;
  evidenceUrl: string | null;
  amount: number;
  verified: boolean;
}

export interface ReconciliationExplanation {
  summary: string;
  grossSales: number;
  stripeFees: number;
  refunds: number;
  chargebacks: number;
  fxAdjustments: number;
  netPayout: number;
  balanced: boolean;
  anomalies: Anomaly[];
  proposedActions: ProposedAction[];
}

export interface ReconciliationJob {
  id: string;
  payoutId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'approved';
  explanation: ReconciliationExplanation | null;
  evidence: ReconciliationEvidence[];
  createdAt: string;
  completedAt: string | null;
  agentModel: string | null;
}

export interface BankTransaction {
  id: string;
  date: string;
  amount: number;
  currency?: string;
  description: string;
  status: 'reconciled' | 'unreconciled';
  payoutId: string | null;
  reconciliationStatus: 'unreconciled' | 'in_progress' | 'reconciled' | 'approved' | 'failed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: ReconciliationEvidence[];
  timestamp: string;
}
