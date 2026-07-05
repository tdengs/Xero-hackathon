import { useQuery } from "@tanstack/react-query";
import {
  approveJob,
  explainPayout,
  fetchJob,
  fetchPayout,
  fetchPayoutSummary,
  fetchPayouts,
} from "@/lib/api";

export const payoutKeys = {
  all: ["payouts"] as const,
  list: () => [...payoutKeys.all, "list"] as const,
  detail: (id: string) => [...payoutKeys.all, "detail", id] as const,
  summary: (id: string) => [...payoutKeys.all, "summary", id] as const,
};

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => [...jobKeys.all, id] as const,
};

export function usePayouts() {
  return useQuery({
    queryKey: payoutKeys.list(),
    queryFn: () => fetchPayouts({ limit: 50 }),
  });
}

export function usePayout(id: string) {
  return useQuery({
    queryKey: payoutKeys.detail(id),
    queryFn: () => fetchPayout(id),
    enabled: !!id,
  });
}

export function usePayoutSummary(id: string) {
  return useQuery({
    queryKey: payoutKeys.summary(id),
    queryFn: () => fetchPayoutSummary(id),
    enabled: !!id,
  });
}

export function useReconciliationJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: jobKeys.detail(jobId ?? "none"),
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
  });
}

export { explainPayout, approveJob };
