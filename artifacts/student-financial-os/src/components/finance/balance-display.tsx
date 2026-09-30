import type { ReactNode } from 'react';
import type { Money } from '@/lib/money';
import { MoneyDisplay } from './money-display';
import { cn } from '@/lib/utils';

/**
 * The dominant figure of a view: label → hero amount → one calm sentence → actions.
 * Only one per screen. No card, no gradient — hierarchy comes from type.
 */
export function BalanceDisplay({
  label,
  amount,
  note,
  tag,
  actions,
  hidden,
  hiddenLabel,
  className,
  testId,
}: {
  label: string;
  amount: Money;
  note?: ReactNode;
  tag?: ReactNode;
  actions?: ReactNode;
  hidden?: boolean;
  hiddenLabel?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 md:gap-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="type-label flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-primary" />
          {label}
        </span>
        {tag}
      </div>
      <MoneyDisplay value={amount} size="hero" hidden={hidden} hiddenLabel={hiddenLabel} testId={testId} />
      {note ? <p className="type-body max-w-xl text-muted-foreground">{note}</p> : null}
      {actions ? <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] items-center gap-2.5 pt-1 sm:flex sm:flex-wrap [&>button]:h-auto [&>button]:min-w-0 [&>button]:whitespace-normal [&>button]:py-2.5 [&>button]:text-center [&>button:first-child]:col-span-2 sm:[&>button:first-child]:col-auto [&>span]:col-span-2">{actions}</div> : null}
    </div>
  );
}
