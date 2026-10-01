import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@workspace/api-client-react';
import { useRefreshFamily } from '@/features/family/family-view';

/** Polling/freshness for student-owned request views (parent views use FAMILY_REFETCH + gate). */
export const STUDENT_REQUEST_REFETCH = { refetchInterval: 20_000, refetchOnWindowFocus: true, refetchOnMount: 'always' as const, staleTime: 0 };
export const NOTIFICATION_REFETCH = { refetchInterval: 20_000, refetchOnMount: 'always' as const, staleTime: 0 };

const isKey = (k: readonly unknown[], prefix: string) => typeof k[0] === 'string' && k[0].startsWith(prefix);

/** After any request mutation: request lists/details, family/parent dashboards, finance/planning/profile, inbox/count. */
export function useAfterRequestMutation() {
  const qc = useQueryClient();
  const family = useRefreshFamily();
  return useCallback(() => Promise.all([
    family(),
    qc.invalidateQueries({ predicate: (q) => isKey(q.queryKey, '/api/notifications') }),
  ]), [qc, family]);
}

export function useRefreshNotifications() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: (q) => isKey(q.queryKey, '/api/notifications') }), [qc]);
}

/** Drop cached request data immediately on 403/404 (revoked/denied). */
export function useDropRequestCache() {
  const qc = useQueryClient();
  return useCallback((prefix: '/api/family/requests' | '/api/parent/requests', keepKey?: string) => {
    // The errored detail query that the page is watching stays (data-less error state renders "unavailable");
    // removing an observed query recreates it pending → refetch → 404 → remove… loop. Pages render the gone branch before any data, so retained data never paints.
    qc.removeQueries({ predicate: (q) => isKey(q.queryKey, prefix) && q.queryKey[0] !== keepKey });
  }, [qc]);
}

/** True when the server answered (key consumed or deliberately rejected) so the next attempt gets a fresh key. */
/** Never retry 403/404 on request reads: revocation must surface on the first answer. */
export const retryUnlessGone = (n: number, err: unknown) => !(err instanceof ApiError && (err.status === 403 || err.status === 404)) && n < 1;

export const answered = (err: unknown) => err instanceof ApiError;
