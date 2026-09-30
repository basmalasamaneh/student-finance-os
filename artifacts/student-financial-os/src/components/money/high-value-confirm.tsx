import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';

/** Presentation-only gate. Both accessible paths invoke the existing action once. */
export function HighValueConfirm({ onConfirm, disabled = false, pending = false, threshold, t, testId, showButtonFallback = true }: {
  onConfirm: () => void; disabled?: boolean; pending?: boolean;
  threshold: { minor: number; currency: 'ILS' }; t: Tx; testId?: string; showButtonFallback?: boolean;
}) {
  const { dir } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; distance: number } | null>(null);
  const called = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || pending;
  const sign = dir === 'rtl' ? -1 : 1;
  useEffect(() => { if (!pending) called.current = false; }, [pending]);

  function confirm() {
    if (blocked || called.current) return;
    called.current = true;
    onConfirm();
    // Keep both paths latched until the original mutation finishes (including errors).
  }
  function start(e: PointerEvent<HTMLButtonElement>) {
    if (blocked || e.button !== 0) return;
    const distance = Math.max(1, (track.current?.clientWidth ?? 0) - 56);
    drag.current = { id: e.pointerId, x: e.clientX, distance };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || blocked) return;
    setOffset(Math.min(d.distance, Math.max(0, (e.clientX - d.x) * sign)));
  }
  function finish(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const reached = (e.clientX - d.x) * sign >= d.distance * 0.9;
    drag.current = null;
    setDragging(false); setOffset(0);
    if (!cancelled && reached) confirm();
  }
  return (
    <div className="flex w-full flex-col gap-3" data-testid="high-value-confirm">
      <p className="type-caption text-muted-foreground">
        {t('Extra confirmation for important simulated payments. The threshold', 'تأكيد إضافي للدفعات المحاكاة المهمة. الحد')}
        {' '}<MoneyDisplay value={threshold} size="sm" className="inline" />{' '}
        {t('applies to ILS only. Other currencies always require this confirmation; no currency conversion is used.', 'ينطبق على الشيكل فقط. العملات الأخرى تتطلب هذا التأكيد دائماً؛ لا يُستخدم تحويل العملات.')}
      </p>
      <div ref={track} className="relative flex h-14 items-center overflow-hidden rounded-full border border-primary/40 bg-primary-soft px-1.5">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center type-caption text-gold-ink">
          {pending ? t('Recording…', 'جارٍ التسجيل…') : t('Slide to confirm', 'اسحب للتأكيد')}
        </span>
        <button type="button" disabled={blocked}
          aria-label={t('Slide to confirm, or press Enter or Space', 'اسحب للتأكيد أو اضغط إدخال أو مسافة')}
          onPointerDown={start} onPointerMove={move} onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={() => { drag.current = null; setDragging(false); setOffset(0); }}
          onClick={(e) => { if (e.detail === 0) confirm(); }}
          style={{ transform: `translateX(${offset * sign}px)`, touchAction: 'pan-y' }}
          className={`relative grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 active:opacity-80 motion-reduce:transition-none ${dragging ? '' : 'transition-transform duration-150'}`}
          data-testid="button-slide-confirm">
          <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      {showButtonFallback ? <Button type="button" onClick={confirm} disabled={blocked} loading={pending} data-testid={testId}>
        {t('Confirm simulated payment', 'تأكيد الدفع المحاكى')}
      </Button> : null}
    </div>
  );
}