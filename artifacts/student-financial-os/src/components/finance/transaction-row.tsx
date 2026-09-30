import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, type LucideIcon } from 'lucide-react';
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
  icon,
  trailing,
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
  /** Optional category icon (replaces the direction glyph; direction stays in the sr-only word + amount sign). */
  icon?: LucideIcon;
  /** Optional extra content under the amount (e.g. a status badge). */
  trailing?: ReactNode;
}) {
  const { locale } = useI18n();
  const Icon = icon ?? (direction === 'in' ? ArrowDownLeft : direction === 'out' ? ArrowUpRight : Clock);
  return (
    <li className="flex min-h-16 items-center gap-3 py-3 sm:gap-4" data-testid={testId}>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          direction === 'in' && 'bg-success-soft text-success',
          direction === 'out' && 'bg-primary-soft text-gold-ink ring-1 ring-inset ring-gold-200/70 dark:ring-gold-800/50',
          direction === 'pending' && 'bg-warning-soft text-warning',
        )}
        aria-hidden
      >
        <Icon className={cn('size-[18px]', !icon && 'rtl:-scale-x-100')} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-subtitle truncate font-medium">{title}</span>
        <span className="type-caption truncate text-muted-foreground">
          {meta} · <time dateTime={date.toISOString()}>{formatDate(date, locale)}</time>
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="sr-only">{directionLabel}</span>
        <MoneyDisplay value={amount} size="sm" className="text-[15px]" tone={direction === 'in' ? 'positive' : direction === 'pending' ? 'muted' : 'default'} showPlus={direction === 'in'} hidden={hidden} hiddenLabel={hiddenLabel} />
        {trailing}
      </div>
    </li>
  );
}

/** Sticky date group header ("Today", "Yesterday", or a date) for grouped transaction lists. */
export function TransactionDateHeader({ label, className }: { label: string; className?: string }) {
  return (
    <div role="heading" aria-level={3} className={cn('date-header -mx-1 px-1 pb-1.5 pt-4 type-caption font-semibold text-muted-foreground', className)} data-testid="text-date-group">
      {label}
    </div>
  );
}

/** Groups items by local calendar day (keeps input order). Label: Today / Yesterday / formatted date. */
export function groupByDay<T>(items: T[], getDate: (item: T) => Date, labels: { today: string; yesterday: string; format: (d: Date) => string }): { key: string; label: string; items: T[] }[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const out: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const d = getDate(item);
    const k = dayKey(d);
    let g = out.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: k === dayKey(now) ? labels.today : k === dayKey(y) ? labels.yesterday : labels.format(d), items: [] };
      out.push(g);
    }
    g.items.push(item);
  }
  return out;
}
