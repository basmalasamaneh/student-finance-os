import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { formatDate, type Money } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';
import { MoneyDisplay } from './money-display';
import { cn } from '@/lib/utils';

export type RowDirection = 'in' | 'out' | 'pending';

/**
 * Reusable activity row. Direction is conveyed by icon + visually-hidden word,
 * not colour alone. Sits on dividers — never wrap in a card.
 */
export function TransactionRow({
  title,
  meta,
  amount,
  date,
  direction,
  directionLabel,
  hidden,
  hiddenLabel,
  testId,
}: {
  title: string;
  meta: string;
  amount: Money;
  date: Date;
  direction: RowDirection;
  directionLabel: string;
  hidden?: boolean;
  hiddenLabel?: string;
  testId?: string;
}) {
  const { locale } = useI18n();
  const Icon = direction === 'in' ? ArrowDownLeft : direction === 'out' ? ArrowUpRight : Clock;
  return (
    <li className="group flex items-center gap-4 py-3.5" data-testid={testId}>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          direction === 'in' && 'bg-success-soft text-success',
          direction === 'out' && 'bg-muted text-foreground',
          direction === 'pending' && 'bg-warning-soft text-warning',
        )}
        aria-hidden
      >
        <Icon className="size-[18px] rtl:-scale-x-100" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {meta} · <time dateTime={date.toISOString()}>{formatDate(date, locale)}</time>
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="sr-only">{directionLabel}</span>
        <MoneyDisplay value={amount} size="sm" tone={direction === 'in' ? 'positive' : direction === 'pending' ? 'muted' : 'default'} showPlus={direction === 'in'} hidden={hidden} hiddenLabel={hiddenLabel} />
      </div>
    </li>
  );
}
