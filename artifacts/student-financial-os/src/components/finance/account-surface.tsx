import type { ReactNode } from 'react';
import type { Money } from '@/lib/money';
import { MoneyDisplay } from './money-display';
import { cn } from '@/lib/utils';

/**
 * Reusable account presentation surface. Presentational only — it receives
 * data from callers and never fetches or computes balances itself.
 */
export function AccountSurface({
  name,
  kind,
  amount,
  meta,
  badge,
  icon,
  hidden,
  hiddenLabel,
  emphasis = false,
  className,
  testId,
}: {
  name: string;
  kind: string;
  amount: Money;
  meta?: string;
  badge?: ReactNode;
  icon: ReactNode;
  hidden?: boolean;
  hiddenLabel?: string;
  emphasis?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <article
      className={cn(
        'flex flex-col gap-6 rounded-xl border border-card-border bg-surface p-5 transition-shadow duration-200 hover:shadow-md md:p-6',
        emphasis && 'border-primary/25 bg-primary-soft/40',
        className,
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:size-5" aria-hidden>
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">{kind}</span>
          </div>
        </div>
        {badge}
      </div>
      <div className="flex flex-col gap-1">
        <MoneyDisplay value={amount} size="lg" hidden={hidden} hiddenLabel={hiddenLabel} />
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </div>
    </article>
  );
}
