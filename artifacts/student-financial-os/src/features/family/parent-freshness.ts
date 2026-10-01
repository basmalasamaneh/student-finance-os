/**
 * Parent confidential freshness gate.
 * On every RETURN event (visibilitychange→visible, window focus, pageshow, and the documented
 * `sfos:privacy-resume` CustomEvent from device-security) parent child data is concealed
 * synchronously — the <html data-parent-refreshing> attribute is set inside the event handler, so
 * CSS hides [data-parent-confidential] before the next paint — then every active `/api/parent/*`
 * query (dashboard, child detail, child allowances, wallet) is refetched. Data reappears only when
 * those refetches settle. 403/404 → the pages' existing isGone cleanup removes cache; any other error
 * replaces content with an error state (pages check isError before data), so cache never shows.
 * Background polling (20s) never conceals — no flicker. Concurrent return events coalesce into one
 * in-flight refetch; subtree stays mounted (no form loss, no mount/refetch loop).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

export const PRIVACY_RESUME_EVENT = 'sfos:privacy-resume';
const ATTR = 'data-parent-refreshing';
// Parent-scoped data plus the shared inbox (its parent entries are consent-scoped too).
const isParentKey = (k: readonly unknown[]) => typeof k[0] === 'string' && (k[0].startsWith('/api/parent') || k[0].startsWith('/api/notifications'));

let concealed = false;
const subs = new Set<() => void>();
const set = (v: boolean) => {
  if (concealed === v) return;
  concealed = v;
  if (v) document.documentElement.setAttribute(ATTR, ''); else document.documentElement.removeAttribute(ATTR);
  subs.forEach((f) => f());
};
let inflight: Promise<unknown> | null = null;
let users = 0;

/** Exported for tests/docs: conceal now, refetch active parent queries, reveal when settled. */
export function concealAndRefresh(qc: QueryClient) {
  set(true);
  if (inflight) return inflight;
  inflight = qc.refetchQueries({ predicate: (q) => isParentKey(q.queryKey), type: 'active' })
    .catch(() => undefined)
    .finally(() => { inflight = null; set(false); });
  return inflight;
}

/** Mount once per parent screen (ParentOnly). Returns whether confidential UI is concealed. */
export function useParentFreshnessGate() {
  const qc = useQueryClient();
  useEffect(() => {
    users++;
    const onReturn = () => { if (document.visibilityState === 'visible') void concealAndRefresh(qc); };
    const onVis = () => { if (document.visibilityState === 'visible') onReturn(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onReturn);
    window.addEventListener('pageshow', onReturn);
    window.addEventListener(PRIVACY_RESUME_EVENT, onReturn);
    return () => {
      users--;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('pageshow', onReturn);
      window.removeEventListener(PRIVACY_RESUME_EVENT, onReturn);
      if (!users && !inflight) set(false);
    };
  }, [qc]);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => concealed, () => false);
}
