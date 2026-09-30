import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { clampSwipe, settleSwipe } from './gesture-math';

export interface SwipeAction { id: string; label: string; icon?: ReactNode; onSelect: () => void; tone?: 'gold' | 'neutral' }

/**
 * Horizontal swipe reveals trailing actions at the END edge (right in LTR, left in RTL).
 * Pointer events (touch, pen and mouse drag). Offset lives in a ref so release never reads a stale
 * render value. Direction comes from the element's computed `direction`, so the side the actions
 * sit on (logical `end-0`) and the side the content moves always agree.
 * Gesture is an accelerator only: every action also exists elsewhere (the row link / detail page).
 */
export function SwipeActions({ actions, children, className, testId }: { actions: SwipeAction[]; children: ReactNode; className?: string; testId?: string }) {
  const width = actions.length * 88;
  const [x, setXState] = useState(0);
  const xRef = useRef(0);
  const setX = (v: number) => { xRef.current = v; setXState(v); };
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const s = useRef<{ x: number; y: number; base: number; lock: 'h' | 'v' | null; id: number; sign: 1 | -1 } | null>(null);
  const moved = useRef(false);
  const open = x !== 0;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rtl = rootRef.current ? getComputedStyle(rootRef.current).direction === 'rtl' : false;
    s.current = { x: e.clientX, y: e.clientY, base: xRef.current, lock: null, id: e.pointerId, sign: rtl ? 1 : -1 };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = s.current; if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x; const dy = e.clientY - st.y;
    if (!st.lock) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { st.lock = 'h'; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported */ } }
      else if (Math.abs(dy) > 10) { s.current = null; return; }
    }
    if (st.lock !== 'h') return;
    moved.current = true; setDragging(true);
    setX(clampSwipe(st.base, dx, width, st.sign));
  };
  const end = (commit: boolean) => (e: React.PointerEvent<HTMLDivElement>) => {
    const st = s.current; if (!st || e.pointerId !== st.id) return;
    s.current = null; setDragging(false);
    if (st.lock !== 'h') return;
    setX(commit ? settleSwipe(xRef.current, width, st.sign) : st.base);
  };

  return (
    <div ref={rootRef} className={cn('swipe-row relative overflow-hidden rounded-card', className)} data-testid={testId}>
      {/* When open, the action layer is raised above the (translated) content so nothing overlaps its hit area. */}
      <div className={cn('absolute inset-y-0 end-0 flex', open && !dragging ? 'z-10' : 'z-0')} aria-hidden={!open} inert={!open ? true : undefined}>
        {actions.map((a) => (
          <button key={a.id} type="button" tabIndex={open ? 0 : -1} onClick={(e) => { e.stopPropagation(); setX(0); a.onSelect(); }}
            className={cn('press flex w-[88px] flex-col items-center justify-center gap-1 text-xs font-semibold', a.tone === 'neutral' ? 'bg-surface-sunken text-foreground' : 'bg-primary text-primary-foreground')}
            data-testid={`swipe-action-${a.id}`}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>
      <div className={cn('relative z-[1]', !dragging && 'transition-transform duration-200 ease-out')} style={{ transform: x ? `translateX(${x}px)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end(true)} onPointerCancel={end(false)}
        onDragStart={(e) => { if (s.current) e.preventDefault(); }}
        onClickCapture={(e) => {
          // Browsers synthesize a click after pointerup. Suppress that click without
          // undoing the swipe that just revealed the actions.
          if (moved.current) {
            e.preventDefault(); e.stopPropagation(); moved.current = false;
            return;
          }
          if (open) { e.preventDefault(); e.stopPropagation(); setX(0); }
        }}>
        {children}
      </div>
    </div>
  );
}
