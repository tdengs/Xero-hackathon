import axios from 'axios';
import type {
  Payout,
  ReconciliationJob,
  ReconciliationEvidence,
  BankTransaction,
  ChatMessage,
} from '@/types';

// Convert snake_case keys to camelCase recursively so frontend types match
// backend JSON without needing per-endpoint mapping.
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function transformKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ])
    );
  }
  return value;
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  transformResponse: [
    (data: string) => {
      try {
        return transformKeys(JSON.parse(data));
      } catch {
        return data;
      }
    },
  ],
});

// Request interceptor: attach Bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 by clearing token and redirecting
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export async function fetchPayouts(params?: {
  limit?: number;
  offset?: number;
}): Promise<Payout[]> {
  const response = await api.get<Payout[]>('/payouts', { params });
  return response.data;
}

export async function fetchPayout(id: string): Promise<Payout> {
  const response = await api.get<Payout>(`/payouts/${id}`);
  return response.data;
}

export async function syncPayouts(): Promise<void> {
  await api.post('/payouts/sync');
}

export async function explainPayout(id: string): Promise<{ jobId: string }> {
  // Backend returns { job_id, status }, camelCased by transformResponse to { jobId, status }.
  const response = await api.post<{ jobId: string; status: string }>(`/payouts/${id}/explain`);
  return { jobId: response.data.jobId };
}

export async function fetchJob(jobId: string): Promise<ReconciliationJob> {
  const response = await api.get<ReconciliationJob>(`/reconciliation/jobs/${jobId}`);
  return response.data;
}

export async function approveReconciliation(
  jobId: string,
  auditNote?: string
): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/reconciliation/jobs/${jobId}/approve`, {
    auditNote,
  });
  return response.data;
}

export async function fetchEvidence(jobId: string): Promise<ReconciliationEvidence[]> {
  const response = await api.get<ReconciliationEvidence[]>(`/reconciliation/jobs/${jobId}/evidence`);
  return response.data;
}

export async function fetchBankTransactions(): Promise<BankTransaction[]> {
  const response = await api.get<BankTransaction[]>('/xero/bank-transactions');
  return response.data;
}

export async function sendChatMessage(
  message: string,
  payoutId?: string
): Promise<{ reply: string; evidence: ReconciliationEvidence[] }> {
  const response = await api.post<{ reply: string; evidence: ReconciliationEvidence[] }>(
    '/chat',
    { message, payoutId }
  );
  return response.data;
}

export async function getXeroAuthorizeUrl(): Promise<string> {
  // Must go through axios (not a plain <a href>) so the Bearer token is attached;
  // the endpoint is auth-protected and returns { url } for the browser to visit.
  const response = await api.get<{ url: string }>('/auth/xero/authorize');
  return response.data.url;
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string }> {
  // Backend returns { access_token, refresh_token, token_type }, but the global
  // transformResponse camelCases every key, so read the camelCase form here.
  const response = await api.post<{ accessToken: string; refreshToken: string; tokenType: string }>(
    '/auth/login',
    { email, password }
  );
  return { token: response.data.accessToken };
}

export type { ChatMessage };

export default api;
