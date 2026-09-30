import { useCallback, useRef } from 'react';
import { resolveSheetRelease } from './gesture-math';

const MOBILE = '(max-width: 768px)';

/**
 * Drag-to-dismiss + two snap points (≈90dvh "full" and 50dvh "half") for bottom sheets on mobile.
 * Pure presentation on top of Radix: dismissal clicks the sheet's own Close control, so Radix's
 * onOpenChange, focus return and scroll lock run exactly as for Esc / backdrop tap.
 * Only drags that start on the grabber zone, or on content already scrolled to top, are captured.
 */
export function useSheetDrag(closeRef: React.RefObject<HTMLElement | null>) {
  const node = useRef<HTMLElement | null>(null);
  const st = useRef<{ y: number; t: number; dy: number; active: boolean; id: number } | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => { node.current = el; }, []);

  const reset = useCallback(() => {
    const el = node.current;
    st.current = null;
    if (el) { el.style.transition = ''; el.style.transform = ''; }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = node.current;
    if (!el || !window.matchMedia(MOBILE).matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('input,textarea,select,button,a,[contenteditable],[data-no-drag]')) return;
    const rect = el.getBoundingClientRect();
    // Handle = the grabber element itself (its enlarged ::before hit zone reports the span as target) or the top 36px strip.
    const onGrabber = !!target.closest('.sheet-grabber') || e.clientY - rect.top < 36;
    // Mouse drags only from the handle, so text selection inside content keeps working.
    if (e.pointerType === 'mouse' && !onGrabber) return;
    if (!onGrabber && el.scrollTop > 0) return;
    // Capture only when the drag starts on the handle zone, so content scrolling is never stolen.
    if (onGrabber) { try { el.setPointerCapture(e.pointerId); } catch { /* unsupported */ } }
    st.current = { y: e.clientY, t: performance.now(), dy: 0, active: onGrabber, id: e.pointerId };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = st.current; const el = node.current;
    if (!s || !el || e.pointerId !== s.id) return;
    const dy = e.clientY - s.y;
    if (!s.active) { if (dy > 10 && el.scrollTop <= 0) s.active = true; else if (dy < -4) { st.current = null; return; } else return; }
    s.dy = dy;
    el.style.transition = 'none';
    if (dy > 0) el.style.transform = `translateY(${dy}px)`;
    else if (el.dataset.snap === 'half') el.style.transform = `translateY(${Math.max(dy, -80) * 0.4}px)`;
  }, []);

  /** Commit (snap or dismiss) — ONLY on a real pointerup. Cleared first so no event can commit twice. */
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = st.current; const el = node.current;
    if (!s || e.pointerId !== s.id) return;
    st.current = null;
    if (el?.hasPointerCapture?.(e.pointerId)) { try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ } }
    if (!el || !s.active) { reset(); return; }
    const v = s.dy / Math.max(1, performance.now() - s.t);
    el.style.transition = '';
    el.style.transform = '';
    const r = resolveSheetRelease({ dy: s.dy, v, h: el.offsetHeight, vh: window.innerHeight, snap: el.dataset.snap === 'half' ? 'half' : 'full' });
    if (r.kind === 'snap') el.dataset.snap = r.to;
    else if (r.kind === 'dismiss') closeRef.current?.click();
  }, [closeRef, reset]);

  /** pointercancel / lostpointercapture: spring back, never snap or dismiss. No-op after a commit. */
  const onPointerCancel = useCallback(() => { if (st.current) reset(); }, [reset]);

  return { ref: setRef, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel } };
}
