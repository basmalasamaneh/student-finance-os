import { cn } from '@/lib/utils';

/** Step indicator for existing multi-step sheets (presentation only; the dialog owns its step state). */
export function FlowSteps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-2" data-testid="flow-steps">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={on ? 'step' : undefined}>
            <span className={cn('h-1 rounded-full transition-colors', done || on ? 'bg-primary' : 'bg-border')} aria-hidden />
            <span className={cn('type-caption truncate', on ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Subtle gold success check. Animation collapses under reduced motion via the global rules. */
export function SuccessCheck({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-1 text-center" data-testid="success-check">
      <span className="motion-pop relative grid size-14 place-items-center rounded-full bg-primary-soft text-gold-ink ring-1 ring-gold-200 dark:ring-gold-800">
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="check-draw" /></svg>
      </span>
      <p className="type-subtitle">{label}</p>
    </div>
  );
}

