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
 * Wrapping rows keep labels and complete amounts readable in narrow containers.
 */
export function FinancialSummary({ items, hidden, hiddenLabel, className, testId }: { items: SummaryItem[]; hidden?: boolean; hiddenLabel?: string; className?: string; testId?: string }) {
  return (
    <dl
      className={cn('grid min-w-0 grid-cols-1 divide-y divide-divider border-y border-divider', className)}
      data-testid={testId}
    >
      {items.map((item) => (
        <div key={item.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5">
          <dt className="type-label min-w-0 font-normal text-muted-foreground">{item.label}</dt>
          <dd className="shrink-0">
            <MoneyDisplay value={item.value} tone={item.tone} showPlus={item.showPlus} className="text-[17px]" hidden={hidden} hiddenLabel={hiddenLabel} testId={`text-summary-${item.id}`} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
