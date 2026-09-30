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
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-primary" />
          {label}
        </span>
        {tag}
      </div>
      <MoneyDisplay value={amount} size="hero" hidden={hidden} hiddenLabel={hiddenLabel} testId={testId} />
      {note ? <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">{note}</p> : null}
      {actions ? <div className="flex flex-wrap items-center gap-2.5 pt-2">{actions}</div> : null}
    </div>
  );
}
