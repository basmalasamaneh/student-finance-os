import type { Money } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';
import { MoneyDisplay } from './money-display';
import { StatusBadge, type StatusTone } from './status-badge';

/**
 * Upcoming payment row. The date block leads so "when" is scannable,
 * the amount trails in tabular figures. Presentational only — no pay action.
 */
export function UpcomingPayment({
  title,
  meta,
  due,
  amount,
  statusTone,
  statusLabel,
  hidden,
  hiddenLabel,
  testId,
}: {
  title: string;
  meta: string;
  due: Date;
  amount: Money;
  statusTone: StatusTone;
  statusLabel: string;
  hidden?: boolean;
  hiddenLabel?: string;
  testId?: string;
}) {
  const { locale } = useI18n();
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(due);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(due);
  return (
    <li className="flex min-h-16 items-center gap-4 py-3" data-testid={testId}>
      <time dateTime={due.toISOString()} className="flex w-11 shrink-0 flex-col items-center border-e border-divider pe-4 leading-none">
        <span className="tabular text-lg font-semibold">{day}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{month}</span>
      </time>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium">{title}</span>
        <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span className="truncate">{meta}</span>
        </span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <MoneyDisplay value={amount} size="sm" className="text-[15px]" hidden={hidden} hiddenLabel={hiddenLabel} />
        <StatusBadge tone={statusTone} label={statusLabel} className="px-2 py-0.5 text-[11px]" />
      </div>
    </li>
  );
}
