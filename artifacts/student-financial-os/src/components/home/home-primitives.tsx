import type { ReactNode } from 'react';
import { CircleDashed } from 'lucide-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { cn } from '@/lib/utils';
import type { CurrencyEstimate } from '@/features/home/student-home-model';

export type T = (en: string, ar: string) => string;

/** One open dashboard block: divider on top, heading row, content. No nested cards. */
export function HomeBlock({ id, title, meta, children, className }: { id: string; title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn('min-w-0 border-t border-divider py-6 md:py-8', className)} data-testid={`section-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
        <h2 id={`${id}-title`} className="type-subtitle text-foreground">{title}</h2>
        {meta ? <span className="type-caption text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Honest "not available yet" state — never a zero. */
export function Unavailable({ label, body, testId }: { label: string; body: string; testId?: string }) {
  return (
    <div className="flex items-start gap-3" data-testid={testId}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><CircleDashed className="size-3.5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="type-label text-foreground">{label}</p>
        <p className="type-caption max-w-prose text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/** Per-currency estimate list. Overflowed values are named, never truncated or summed. */
export function EstimateList({ items, t, testId }: { items: CurrencyEstimate[]; t: T; testId: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => (
        <li key={c.currency} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1" data-testid={`${testId}-${c.currency}`}>
          {c.result.ok
            ? <MoneyDisplay value={{ minor: c.result.minor, currency: c.currency }} size="lg" tone="projected" />
            : <span className="type-label text-destructive">{t(`${c.currency} estimate too large to display exactly`, `تقدير ${c.currency} أكبر من أن يُعرض بدقة`)}</span>}
          <span className="type-caption text-muted-foreground">{t(`${c.sourceCount} recurring source${c.sourceCount === 1 ? '' : 's'}`, `مصادر متكررة: ${c.sourceCount}`)}{c.allowanceAdjustment ? ` · ${t('incl. scheduled parent allowance', 'يشمل مصروف ولي الأمر المجدول')}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function Fact({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <dt className="type-caption text-muted-foreground">{label}</dt>
      <dd className="type-label min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}
