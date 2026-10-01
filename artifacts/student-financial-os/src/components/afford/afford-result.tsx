/** Prompt 13 result rendering — server values only (MoneyDisplay), localized codes, no verdicts. */
import { Link } from 'wouter';
import { RefreshCw } from 'lucide-react';
import type { AffordabilityComparison, AffordabilityRequest, AffordabilityScenario, AffordabilityCashComparison, FinanceAccount } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel, Notice, RetryButton } from '@/components/states/state-panel';
import { Assumptions } from '@/components/upcoming/upcoming-views';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { accountName, type Tx } from '@/features/money/money-model';
import { CATEGORY } from '@/features/planning/planning-model';
import { formatDate, type Money } from '@/lib/money';
import { AFFORD_ONLY_CODES, FORECAST_POLICY_CODES, SITUATION_CODES, codeText } from '@/features/afford/afford-model';

export type RunState =
  | { kind: 'idle' }
  | { kind: 'pending'; request: AffordabilityRequest }
  | { kind: 'done'; request: AffordabilityRequest; result: AffordabilityComparison }
  | { kind: 'error'; request: AffordabilityRequest; message: string };

export const letter = (i: number) => String.fromCharCode(65 + i);

function useFmt(locale: string) {
  return (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return Number.isNaN(d.getTime()) ? iso : formatDate(d, locale, 'UTC'); };
}

function Row({ label, value, testId, emphasis }: { label: string; value: Money; testId: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
      <dt className={"min-w-0 [overflow-wrap:anywhere] " + (emphasis ? 'type-label' : 'type-caption text-muted-foreground')}>{label}</dt>
      <dd className="ms-auto max-w-full"><MoneyDisplay value={value} size={emphasis ? 'md' : 'sm'} tone="projected" testId={testId} /></dd>
    </div>
  );
}

function CashBlock({ title, cash, t, prefix }: { title: string; cash: AffordabilityCashComparison; t: Tx; prefix: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-sunken p-3">
      <p className="type-label [overflow-wrap:anywhere]">{title}</p>
      <dl className="divide-y divide-divider">
        <Row label={t('Before', 'قبل')} value={cash.before} testId={`${prefix}-before`} />
        <Row label={t('After purchase', 'بعد الشراء')} value={cash.after} testId={`${prefix}-after`} emphasis />
        <Row label={t('Short by', 'النقص')} value={cash.shortfall} testId={`${prefix}-shortfall`} />
      </dl>
    </div>
  );
}

export function ResultArea({ run, t, locale, accounts, onRerun }: { run: RunState; t: Tx; locale: string; accounts: FinanceAccount[]; onRerun: () => void }) {
  const fmt = useFmt(locale);
  if (run.kind === 'idle') {
    return <StatePanel tone="empty" align="center" title={t('Nothing compared yet', 'لا مقارنة بعد')}
      body={t('Add one to four options, then Compare. Results always reflect the data at the moment you compare.', 'أضف من خيار إلى أربعة ثم «قارن». تعكس النتائج البيانات لحظة المقارنة.')} />;
  }
  if (run.kind === 'pending') {
    return (
      <div role="status" aria-label={t('Comparing', 'جارٍ المقارنة')} className="flex flex-col gap-4" data-testid="state-loading">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    );
  }
  if (run.kind === 'error') {
    return <StatePanel tone="error" title={t('Comparison didn’t load', 'تعذّر تحميل المقارنة')} body={run.message}
      action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ…')} onClick={onRerun} />} />;
  }
  const r = run.result;
  return (
    <div className="stagger flex min-w-0 flex-col gap-5" data-testid="result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption min-w-0 text-muted-foreground [overflow-wrap:anywhere]" data-testid="text-asof">
          {t('Estimate · as of', 'تقدير · حتى')} {fmt(r.asOf)} · {t('window to', 'النافذة حتى')} {fmt(r.through)}
        </p>
        <Button variant="tertiary" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal text-start" onClick={onRerun} data-testid="button-refresh-comparison"><RefreshCw aria-hidden />{t('Rerun with current data', 'أعد المقارنة ببيانات حالية')}</Button>
      </div>
      {r.scenarios.map((s) => <ScenarioResult key={s.index} s={s} t={t} fmt={fmt} accounts={accounts} />)}
      {/* Forecast policy: reuse the localized Prompt 11 list (today-dated income, recurrence, manual priority,
          monthly allocation, max goals/allowance envelope, reserves/no FX). Afford-only codes are listed after it. */}
      <Assumptions forecast={{ assumptionCodes: r.assumptionCodes.filter((c) => !AFFORD_ONLY_CODES.has(c) && !FORECAST_POLICY_CODES.has(c)) }} t={t} />
      <ul className="flex list-disc flex-col gap-1.5 ps-5 type-caption text-muted-foreground" data-testid="list-afford-policy">
        <li data-testid="text-policy">{codeText(r.comparisonPolicy, t)}</li>
        {r.assumptionCodes.filter((c) => AFFORD_ONLY_CODES.has(c) && c !== r.comparisonPolicy).map((c) => <li key={c} data-testid={`assumption-${c}`}>{codeText(c, t)}</li>)}
      </ul>
      <Link href="/upcoming" className="type-label inline-flex min-h-11 items-center text-gold-ink underline underline-offset-4" data-testid="link-upcoming">{t('See the full forecast', 'عرض التوقع الكامل')}</Link>
    </div>
  );
}

function ScenarioResult({ s, t, fmt, accounts }: { s: AffordabilityScenario; t: Tx; fmt: (iso: string) => string; accounts: FinanceAccount[] }) {
  const k = s.index;
  const b = s.baseline;
  const g = s.goalContext;
  const situations = s.messageCodes.filter((c) => SITUATION_CODES.has(c));
  const notes = s.messageCodes.filter((c) => !SITUATION_CODES.has(c));
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5" data-testid={`card-scenario-${k}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="type-subtitle flex min-w-0 items-center gap-2"><Badge variant="outline" className="shrink-0">{letter(k)}</Badge><span className="min-w-0 break-words [overflow-wrap:anywhere]">{s.item}</span></div>
          <p className="type-caption text-muted-foreground">
            {fmt(s.purchaseDate)}{s.category ? ` · ${t(...(CATEGORY[s.category] ?? [s.category, s.category]))}` : ''}
          </p>
        </div>
        <MoneyDisplay value={s.price} size="md" testId={`text-price-${k}`} />
      </div>

      {situations.length ? <div className="flex flex-col gap-2">{situations.map((c) => <Notice key={c} tone="info" title={t('Worth knowing', 'للعلم')} body={codeText(c, t)} />)}</div> : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <CashBlock title={t('Money available now', 'المال المتاح الآن')} cash={s.currentCash} t={t} prefix={`text-cash-${k}`} />
        {s.accountComparison ? (
          <CashBlock title={`${t('Selected account', 'الحساب المختار')} · ${accountName(accounts.find((a) => a.id === s.accountComparison!.accountId), t)}`}
            cash={s.accountComparison.cash} t={t} prefix={`text-account-${k}`} />
        ) : null}
      </div>

      <div className="min-w-0 rounded-xl border border-border p-3" data-testid={`projection-${k}`}>
        <p className="type-label">{t('Projection to end of window', 'التوقع حتى نهاية النافذة')} · {b.currency}</p>
        <dl className="divide-y divide-divider">
          <Row label={t('Available at start', 'المتاح في البداية')} value={b.availableOpening} testId={`text-opening-${k}`} />
          <Row label={t('+ Expected income', '+ الدخل المتوقع')} value={b.expectedIncome} testId={`text-income-${k}`} />
          <Row label={t('− Upcoming expenses', '− المصاريف القادمة')} value={b.upcomingExpenses} testId={`text-upcoming-${k}`} />
          <Row label={t('− Recurring expenses', '− المصاريف المتكررة')} value={b.recurringExpenses} testId={`text-recurring-${k}`} />
          <Row label={t('− Planned savings', '− الادخار المخطط')} value={b.plannedSavings} testId={`text-savings-${k}`} />
          <Row label={t('Projected without this purchase', 'المتوقع دون هذا الشراء')} value={b.projectedBalance} testId={`text-baseline-${k}`} emphasis />
          <Row label={t('Projected with this purchase', 'المتوقع مع هذا الشراء')} value={s.projectedAfterPurchase} testId={`text-after-${k}`} emphasis />
          <Row label={t('Projected short by', 'النقص المتوقع')} value={s.projectedShortfall} testId={`text-proj-shortfall-${k}`} />
        </dl>
      </div>

      <div className="flex flex-col gap-2" data-testid={`budgets-${k}`}>
        <p className="type-label">{t('Budget', 'الميزانية')}</p>
        {s.budgets.length === 0 ? (
          <p className="type-caption text-muted-foreground">{s.budgetAssessment === 'category_not_provided'
            ? t('No category chosen, so no budget is compared.', 'لم تُختر فئة، لذا لا تُقارن ميزانية.')
            : s.budgetAssessment === 'not_configured' ? t('No budget is set for this category.', 'لا توجد ميزانية لهذه الفئة.')
            : t('No budget applies to this period.', 'لا ميزانية تنطبق على هذه الفترة.')}</p>
        ) : s.budgets.map((bu, i) => (
          <div key={`${bu.period}-${i}`} className="rounded-xl bg-surface-sunken p-3" data-testid={`budget-${k}-${i}`}>
            <p className="type-caption font-medium">
              {bu.period === 'weekly' ? t('Weekly', 'أسبوعية') : t('Monthly', 'شهرية')} · {t(...(CATEGORY[bu.category] ?? [bu.category, bu.category]))} · {fmt(bu.periodStart)} – {fmt(bu.periodEnd)}
            </p>
            <dl className="divide-y divide-divider">
              <Row label={t('Limit', 'الحد')} value={bu.limit} testId={`text-budget-limit-${k}-${i}`} />
              <Row label={t('Spent so far', 'المصروف حتى الآن')} value={bu.actualSpent} testId={`text-budget-spent-${k}-${i}`} />
              <Row label={t('Left before purchase', 'المتبقي قبل الشراء')} value={bu.remainingBefore} testId={`text-budget-before-${k}-${i}`} />
              {bu.remainingAfter ? <Row label={t('Left after purchase', 'المتبقي بعد الشراء')} value={bu.remainingAfter} testId={`text-budget-after-${k}-${i}`} emphasis /> : null}
              {bu.shortfallAfter ? <Row label={t('Over budget by', 'تجاوز الميزانية بـ')} value={bu.shortfallAfter} testId={`text-budget-over-${k}-${i}`} /> : null}
            </dl>
            {bu.assessment === 'outside_current_period' ? <p className="type-caption text-muted-foreground">{t('The purchase date is outside this budget period, so it isn’t counted against it.', 'تاريخ الشراء خارج فترة هذه الميزانية، لذا لا يُحتسب عليها.')}</p> : null}
          </div>
        ))}
        <p className="type-caption text-muted-foreground">{t('Budgets are a limit to compare with — never an extra expense.', 'الميزانية حدّ للمقارنة — وليست مصروفاً إضافياً.')}</p>
      </div>

      <div className="flex flex-col gap-2" data-testid={`goals-${k}`}>
        <p className="type-label">{t('Goals in this currency', 'الأهداف بهذه العملة')}</p>
        <dl className="divide-y divide-divider">
          <Row label={t('Protected in goal reserves', 'محمي في احتياطي الأهداف')} value={g.protectedReserves} testId={`text-goal-reserves-${k}`} />
          <Row label={t('Required monthly for dated goals', 'المطلوب شهرياً للأهداف المؤرخة')} value={g.requiredMonthly} testId={`text-goal-required-${k}`} />
          <Row label={t('Planned monthly savings', 'الادخار الشهري المخطط')} value={g.effectiveMonthlySavings} testId={`text-goal-effective-${k}`} />
          <Row label={t('Planned savings in this window', 'الادخار المخطط في هذه النافذة')} value={g.plannedSavingsInHorizon} testId={`text-goal-horizon-${k}`} />
          <Row label={t('Projected room after purchase', 'الهامش المتوقع بعد الشراء')} value={g.projectedHeadroomAfter} testId={`text-goal-headroom-${k}`} emphasis />
          <Row label={t('Projected short by', 'النقص المتوقع')} value={g.projectedShortfallAfter} testId={`text-goal-shortfall-${k}`} />
        </dl>
        {g.potentialPressure ? <Notice tone="info" title={t('Possible pressure on goals', 'ضغط محتمل على الأهداف')} body={codeText('goal_pressure_possible', t)} /> : null}
        {g.goals.length === 0 ? <p className="type-caption text-muted-foreground">{t('No active goals in this currency.', 'لا أهداف نشطة بهذه العملة.')}</p> : (
          <ul className="flex flex-col gap-2">
            {g.goals.map((goal) => (
              <li key={goal.id} className="rounded-xl bg-surface-sunken p-3" data-testid={`goal-${k}-${goal.id}`}>
                <Link href={`/goals/${goal.id}`} className="type-label inline-flex min-h-11 items-center underline-offset-4 hover:underline">{goal.name}</Link>
                <dl className="divide-y divide-divider">
                  <Row label={t('Target', 'الهدف')} value={goal.target} testId={`text-goal-target-${goal.id}`} />
                  <Row label={t('Saved', 'المدخر')} value={goal.current} testId={`text-goal-current-${goal.id}`} />
                  <Row label={t('Remaining', 'المتبقي')} value={goal.remaining} testId={`text-goal-remaining-${goal.id}`} />
                  {goal.requiredContributionMonthly ? <Row label={t('Needed per month', 'المطلوب شهرياً')} value={goal.requiredContributionMonthly} testId={`text-goal-monthly-${goal.id}`} /> : null}
                </dl>
                <p className="type-caption text-muted-foreground">
                  {goal.targetDate ? `${t('Target date', 'التاريخ المستهدف')}: ${fmt(goal.targetDate)}` : t('No target date', 'بلا تاريخ مستهدف')}
                  {' · '}
                  {goal.baselineEstimatedCompletion ? `${t('Current estimate before this purchase', 'التقدير الحالي قبل هذا الشراء')}: ${fmt(goal.baselineEstimatedCompletion)}` : t('No completion estimate', 'لا يوجد تقدير للإنجاز')}
                </p>
              </li>
            ))}
          </ul>
        )}
        {g.timelineImpact === 'not_calculated' ? <p className="type-caption text-muted-foreground">{codeText('goal_timeline_not_calculated', t)}</p> : null}
      </div>

      {notes.length ? (
        <ul className="flex list-disc flex-col gap-1 ps-5 type-caption text-muted-foreground" data-testid={`notes-${k}`}>
          {notes.map((c) => <li key={c}>{codeText(c, t)}</li>)}
        </ul>
      ) : null}
    </Card>
  );
}
