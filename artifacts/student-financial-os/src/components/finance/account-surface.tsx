import type { ReactNode } from 'react';
import type { Money } from '@/lib/money';
import { MoneyDisplay } from './money-display';
import { cn } from '@/lib/utils';

/**
 * Reusable account presentation surface — the "raised surface" level.
 * Presentational only: receives data, never fetches or computes balances.
 * `emphasis` adds a gold hairline, not a gold fill.
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
        'relative flex min-w-0 flex-col gap-6 rounded-card border border-card-border bg-surface p-5 transition-colors duration-150 hover:border-input md:p-6',
        className,
      )}
      data-testid={testId}
    >
      {emphasis ? <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-primary" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-surface-sunken text-foreground/80 [&_svg]:size-[18px]" aria-hidden>
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="type-label font-medium">{name}</span>
            <span className="type-caption text-muted-foreground">{kind}</span>
          </div>
        </div>
        {badge}
      </div>
      <div className="flex flex-col gap-1.5">
        <MoneyDisplay value={amount} size="lg" hidden={hidden} hiddenLabel={hiddenLabel} />
        {meta ? <span className="type-label font-normal text-muted-foreground">{meta}</span> : null}
      </div>
    </article>
  );
}
