import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPayouts,
  fetchJob,
  explainPayout,
  approveReconciliation,
} from '@/services/api';
import type { Payout, ReconciliationJob } from '@/types';

export function usePayouts(params?: { limit?: number; offset?: number }) {
  return useQuery<Payout[]>({
    queryKey: ['payouts', params],
    queryFn: () => fetchPayouts(params),
    staleTime: 30_000,
  });
}

export function useReconciliationJob(jobId: string | null) {
  return useQuery<ReconciliationJob>({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.status === 'completed' || data.status === 'failed') return false;
      return 2000;
    },
    staleTime: 0,
  });
}

export function useExplainPayout() {
  const mutation = useMutation<{ jobId: string }, Error, string>({
    mutationFn: (payoutId: string) => explainPayout(payoutId),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useApproveReconciliation() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { jobId: string; auditNote?: string }
  >({
    mutationFn: ({ jobId, auditNote }) => approveReconciliation(jobId, auditNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}
