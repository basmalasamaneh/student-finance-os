import { RotateCw } from 'lucide-react';
import { Page, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/states/state-panel';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTx } from '@/features/money/money-model';
import { formatUtcDate, planErrorText, usePlan } from '@/features/planning/planning-model';
import { CostSources, EquationCard, PolicyPanel } from '@/components/planning/plan-totals';
import { BudgetsSection } from '@/components/planning/budgets-section';
import { RecurringSection } from '@/components/planning/recurring-section';
import { LinesSection } from '@/components/planning/lines-section';
import { IncomeSection, UpcomingSection } from '@/components/planning/income-section';
import { HousingCommuteSection } from '@/components/planning/housing-commute';

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy data-testid="state-loading">
      <div className="grid gap-4 md:grid-cols-2"><div className="skeleton-shimmer h-64 rounded-2xl" /><div className="skeleton-shimmer h-64 rounded-2xl" /></div>
      {[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-24 rounded-xl" />)}
    </div>
  );
}

export default function PlanPage() {
  const t = useTx();
  const { locale } = useI18n();
  const plan = usePlan();
  const p = plan.data;

  return (
    <Page>
      <PageHeader eyebrow={t('PLAN', 'الخطة')} title={t('Your monthly plan', 'خطتك الشهرية')}
        lede={t('Income minus expenses minus savings, per currency. Everything here is an estimate — your ledger balance never changes from planning.', 'الدخل ناقص المصاريف ناقص الادخار لكل عملة. كل ما هنا تقدير — رصيد دفترك لا يتغير بسبب التخطيط.')} />
      {plan.isLoading ? <PlanSkeleton /> : plan.isError || !p ? (
        <StatePanel tone="error" title={t('Plan could not load', 'تعذّر تحميل الخطة')} body={planErrorText(plan.error, t)}
          action={<Button variant="outline" onClick={() => void plan.refetch()} data-testid="button-retry-plan"><RotateCw aria-hidden />{t('Retry', 'أعد المحاولة')}</Button>} />
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-col gap-4 pb-8">
            {p.totals.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{p.totals.map((tot) => <EquationCard key={tot.currency} tot={tot} t={t} />)}</div>
            ) : (
              <StatePanel tone="empty" title={t('Nothing planned yet', 'لا شيء مخطط بعد')} body={t('No income, expenses or savings are saved, so there is no projection. Start with a plan line or add income in your profile.', 'لا دخل أو مصاريف أو ادخار محفوظ، لذا لا توجد توقعات. ابدأ ببند خطة أو أضف دخلاً في ملفك.')} />
            )}
            <p className="type-caption text-muted-foreground" data-testid="text-plan-asof">{t('As of', 'حتى')} {formatUtcDate(p.asOf, locale)}{plan.isFetching ? ` · ${t('refreshing…', 'جارٍ التحديث…')}` : ''}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><PolicyPanel plan={p} t={t} /><CostSources plan={p} t={t} /></div>
          </div>
          <BudgetsSection budgets={p.budgets} t={t} />
          <LinesSection lines={p.lines} t={t} />
          <RecurringSection items={p.recurringExpenses} t={t} />
          <HousingCommuteSection plan={p} t={t} />
          <IncomeSection plan={p} t={t} />
          <UpcomingSection plan={p} t={t} />
        </div>
      )}
    </Page>
  );
}
