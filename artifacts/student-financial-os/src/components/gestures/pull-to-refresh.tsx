import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;
const MAX = 110;

/**
 * Touch-only pull-to-refresh. Calls `onRefresh` (a real query refetch) and shows a gold spinner
 * until the returned promise settles. Never fabricates data: the list below simply re-renders from
 * the refetched query. Keyboard/mouse users keep the page's existing Retry/refresh affordances.
 */
export function PullToRefresh({ onRefresh, children, label, className }: { onRefresh: () => Promise<unknown>; children: ReactNode; label: string; className?: string }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ y: number; x: number } | null>(null);
  const active = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (busy || window.scrollY > 0 || e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('[role="dialog"],[data-no-ptr]')) return;
    start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    active.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dy = e.touches[0].clientY - start.current.y;
    const dx = Math.abs(e.touches[0].clientX - start.current.x);
    if (!active.current) {
      if (dy > 8 && dy > dx && window.scrollY <= 0) active.current = true;
      else if (dy < 0 || dx > 10) { start.current = null; return; }
    }
    if (active.current) setPull(Math.min(MAX, dy * 0.5));
  };
  const onTouchEnd = () => {
    if (!start.current) return;
    start.current = null;
    if (active.current && pull >= THRESHOLD * 0.75) {
      setBusy(true);
      setPull(THRESHOLD * 0.75);
      Promise.resolve(onRefresh()).catch(() => undefined).finally(() => { setBusy(false); setPull(0); });
    } else setPull(0);
    active.current = false;
  };

  const progress = Math.min(1, pull / (THRESHOLD * 0.75));
  return (
    <div className={cn('relative', className)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div aria-hidden={!busy} role={busy ? 'status' : undefined} className="ptr-indicator pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ transform: `translateY(${pull - 44}px)`, opacity: busy ? 1 : progress }}>
        <span className={cn('ptr-spinner', busy && 'ptr-spinning')} style={busy ? undefined : { transform: `rotate(${progress * 270}deg)` }} />
        {busy ? <span className="sr-only">{label}</span> : null}
      </div>
      <div className="ptr-content" style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>{children}</div>
    </div>
  );
}
