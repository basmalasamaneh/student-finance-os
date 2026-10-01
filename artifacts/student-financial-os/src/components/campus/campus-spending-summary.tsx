import { getGetCampusSpendingSummaryQueryKey, useGetCampusSpendingSummary, type GetCampusSpendingSummaryParams } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { apiErrorText, CATEGORY_LABEL, label, type Tx } from '@/features/money/money-model';

const CATS = ['food', 'books', 'printing', 'transportation', 'fees', 'other'] as const;

/** Monthly campus spending: full server ledger totals per currency (never the latest-activity list). */
export function CampusSpendingSummaryView({ params, t }: { params: GetCampusSpendingSummaryParams; t: Tx }) {
  const q = useGetCampusSpendingSummary(params, { query: { queryKey: getGetCampusSpendingSummaryQueryKey(params), refetchOnWindowFocus: true } });
  if (q.isPending) return <SkeletonRows rows={3} label={t('Loading campus spending…', 'جارٍ تحميل الإنفاق الجامعي…')} />;
  if (q.isError) return <StatePanel tone="error" className="py-4" title={t('Spending summary did not load', 'تعذّر تحميل ملخص الإنفاق')} body={apiErrorText(q.error, t)} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={q.isRefetching} onClick={() => q.refetch()} />} />;
  if (!q.data.totals.length) return <StatePanel tone="empty" className="py-4" title={t('No campus spending this month', 'لا إنفاق جامعي هذا الشهر')} body={t('Simulated campus payments for this month and filter will be totalled here.', 'ستُجمع هنا مدفوعات الحرم المحاكاة لهذا الشهر والفلتر.')} />;
  return (
    <div className="flex flex-col gap-6" data-testid="campus-spending-summary">
      {q.data.totals.map((row) => (
        <div key={row.currency} className="flex flex-col gap-3" data-testid={`campus-spending-${row.currency}`}>
          <div className="flex items-baseline justify-between gap-3 border-b border-divider pb-2">
            <span className="type-label text-muted-foreground">{t(`Total · ${row.currency}`, `الإجمالي · ${row.currency}`)}</span>
            <MoneyDisplay value={row.spending} size="lg" />
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {CATS.map((c) => (
              <li key={c} className="flex min-w-0 items-center justify-between gap-2">
                <span className="type-caption truncate text-muted-foreground">{label(CATEGORY_LABEL, c, t)}</span>
                <MoneyDisplay value={row[c]} size="sm" tone={row[c].minor ? 'default' : 'muted'} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
