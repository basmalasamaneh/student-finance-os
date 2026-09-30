/** Pure gesture decisions (unit-tested in gesture-math.test.ts; no DOM). */

/** Row offset after a horizontal drag. sign = -1 reveals on the right (LTR), +1 on the left (RTL). */
export function clampSwipe(base: number, dx: number, width: number, sign: 1 | -1, overshoot = 24): number {
  const next = base + dx;
  return sign < 0 ? Math.max(-width - overshoot, Math.min(0, next)) : Math.min(width + overshoot, Math.max(0, next));
}

/** Where a released row settles: fully open or closed. */
export function settleSwipe(x: number, width: number, sign: 1 | -1): number {
  return Math.abs(x) > width / 2 ? sign * width : 0;
}

export type SheetSnap = 'full' | 'half';
export type SheetRelease = { kind: 'reset' } | { kind: 'snap'; to: SheetSnap } | { kind: 'dismiss' };

/**
 * Sheet release on a real pointerup. dy > 0 = downward, v in px/ms, h = sheet height, vh = viewport.
 * Half snap exists only for tall sheets (> 62% of viewport); short sheets just dismiss or spring back.
 */
export function resolveSheetRelease({ dy, v, h, vh, snap }: { dy: number; v: number; h: number; vh: number; snap: SheetSnap }): SheetRelease {
  if (dy < -40 && snap === 'half') return { kind: 'snap', to: 'full' };
  if (dy > h * 0.3 || v > 0.9) {
    if (snap !== 'half' && h > vh * 0.62 && v <= 0.9) return { kind: 'snap', to: 'half' };
    return { kind: 'dismiss' };
  }
  return { kind: 'reset' };
}

/** Scroll restoration: can the document currently reach `target` (within 2px)? */
export function canReachScroll(target: number, scrollHeight: number, viewportHeight: number): boolean {
  return target <= 0 || Math.max(0, scrollHeight - viewportHeight) >= target - 2;
}
