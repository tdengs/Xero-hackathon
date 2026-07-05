export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
}

export interface PayoutListItem {
  id: string;
  stripePayoutId: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  reconciliationStatus: string;
}

export interface PayoutItemOut {
  id: string;
  stripeBalanceTransactionId: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  xeroInvoiceId?: string | null;
  xeroInvoiceNumber?: string | null;
}

export interface PayoutDetail {
  id: string;
  stripePayoutId: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  reconciliationStatus: string;
  description: string | null;
  items: PayoutItemOut[];
  jobId?: string | null;
  jobStatus?: string | null;
}

export interface PayoutSummary {
  grossSales: number;
  stripeFees: number;
  refunds: number;
  chargebacks: number;
  fxAdjustments: number;
  netPayout: number;
  balanced: boolean;
  paymentCount: number;
  anomalies: string[];
}

export interface ProposedAction {
  action: string;
  description: string;
  requiresApproval?: boolean;
  journalLines?: Array<Record<string, unknown>>;
}

export interface ReconciliationExplanation {
  summary?: string;
  grossSales?: number;
  stripeFees?: number;
  refunds?: number;
  chargebacks?: number;
  fxAdjustments?: number;
  netPayout?: number;
  balanced?: boolean;
  needsHumanReview?: boolean;
  anomalies?: string[];
  proposedActions?: ProposedAction[];
  evidence?: Array<{
    claim: string;
    evidenceType: string;
    evidenceId: string;
    amount: number | null;
  }>;
}

export interface ReconciliationJob {
  id: string;
  payoutId: string;
  status: string;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  explanation: ReconciliationExplanation | null;
  errorMessage?: string | null;
}

export interface ApproveResponse {
  approved: boolean;
  actionsExecuted: number;
  message: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: string;
}
