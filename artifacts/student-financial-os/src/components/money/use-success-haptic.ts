import { useEffect, useRef } from 'react';

/** Optional feedback for an actual successful action, never on page load. */
export function useSuccessHaptic(successKey: string | null) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!successKey || last.current === successKey) return;
    last.current = successKey;
    if (typeof navigator.vibrate !== 'function' || document.documentElement.dataset.motion === 'reduce'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { navigator.vibrate(35); } catch { /* Optional hardware capability. */ }
  }, [successKey]);
}