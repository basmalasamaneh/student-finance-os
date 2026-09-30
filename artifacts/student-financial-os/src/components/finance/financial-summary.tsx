import type { Money } from '@/lib/money';
import { MoneyDisplay, type MoneyTone } from './money-display';
import { cn } from '@/lib/utils';

export interface SummaryItem {
  id: string;
  label: string;
  value: Money;
  tone?: MoneyTone;
  showPlus?: boolean;
}

/**
 * Open financial summary: a definition list separated by hairlines, not KPI cards.
 * Stacks as rows on mobile, becomes columns from `sm`.
 */
export function FinancialSummary({ items, hidden, hiddenLabel, className, testId }: { items: SummaryItem[]; hidden?: boolean; hiddenLabel?: string; className?: string; testId?: string }) {
  return (
    <dl
      className={cn('grid divide-y divide-divider border-y border-divider sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse', className)}
      data-testid={testId}
    >
      {items.map((item, i) => (
        <div key={item.id} className={cn('flex items-baseline justify-between gap-4 py-3.5 sm:flex-col sm:justify-start sm:gap-1.5 sm:py-4', i > 0 && 'sm:ps-5', i < items.length - 1 && 'sm:pe-5')}>
          <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
          <dd>
            <MoneyDisplay value={item.value} tone={item.tone} showPlus={item.showPlus} className="text-[17px]" hidden={hidden} hiddenLabel={hiddenLabel} testId={`text-summary-${item.id}`} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
