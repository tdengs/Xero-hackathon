import { clearAccessToken, getAccessToken, setAccessToken } from "./auth";
import type {
  ApproveResponse,
  AuditLogItem,
  PayoutDetail,
  PayoutListItem,
  PayoutSummary,
  ReconciliationJob,
  TokenResponse,
  UserProfile,
} from "./api-types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function transformKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ]),
    );
  }
  return value;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return transformKeys(JSON.parse(text)) as T;
  } catch {
    throw new Error("Invalid response from server");
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    const isLogin = path.includes("/auth/login");
    if (!isLogin && typeof window !== "undefined") {
      clearAccessToken();
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    const body = await parseJson<{ detail?: string; message?: string }>(response).catch(
      () => ({}) as { detail?: string; message?: string },
    );
    throw new Error(body.detail ?? body.message ?? `Request failed (${response.status})`);
  }

  return parseJson<T>(response);
}

export async function login(email: string, password: string): Promise<void> {
  const data = await request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
}

export async function register(email: string, password: string): Promise<void> {
  const data = await request<TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
}

export async function fetchMe(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me");
}

export async function fetchPayouts(params?: {
  limit?: number;
  offset?: number;
}): Promise<PayoutListItem[]> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.size ? `?${qs}` : "";
  return request<PayoutListItem[]>(`/payouts/${suffix}`);
}

export async function fetchPayout(id: string): Promise<PayoutDetail> {
  return request<PayoutDetail>(`/payouts/${id}`);
}

export async function fetchPayoutSummary(id: string): Promise<PayoutSummary> {
  return request<PayoutSummary>(`/payouts/${id}/summary`);
}

export async function syncPayouts(): Promise<void> {
  await request("/payouts/sync", { method: "POST" });
}

export async function explainPayout(id: string): Promise<{ jobId: string; status: string }> {
  return request<{ jobId: string; status: string }>(`/payouts/${id}/explain`, {
    method: "POST",
  });
}

export async function fetchJob(jobId: string): Promise<ReconciliationJob> {
  return request<ReconciliationJob>(`/reconciliation/jobs/${jobId}`);
}

export async function approveJob(jobId: string): Promise<ApproveResponse> {
  return request<ApproveResponse>(`/reconciliation/jobs/${jobId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchAuditLog(limit = 50): Promise<AuditLogItem[]> {
  return request<AuditLogItem[]>(`/reconciliation/audit?limit=${limit}`);
}

export async function getXeroAuthorizeUrl(): Promise<string> {
  const data = await request<{ url: string }>("/auth/xero/authorize");
  return data.url;
}

export async function checkXeroConnected(): Promise<boolean> {
  try {
    await request("/xero/accounts");
    return true;
  } catch {
    return false;
  }
}
