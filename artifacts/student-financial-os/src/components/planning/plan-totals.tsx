import { ChevronDown } from 'lucide-react';
import type { FinancialPlan, PlanTotals } from '@workspace/api-client-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MoneyDisplay } from '@/components/finance/money-display';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY, COST_SOURCE, lbl } from '@/features/planning/planning-model';
import { cn } from '@/lib/utils';

function Term({ label, children, op }: { label: string; children: React.ReactNode; op?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2">
      <dt className="type-label font-normal text-muted-foreground"><span aria-hidden className="inline-block w-4 text-foreground">{op}</span>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Income − expenses − savings = projected remaining, per currency, exactly as the server computed it. */
export function EquationCard({ tot, t }: { tot: PlanTotals; t: Tx }) {
  const neg = tot.projectedRemaining.minor < 0;
  return (
    <div className="min-w-0 rounded-2xl border border-card-border bg-card p-5 shadow-sm md:p-6" data-testid={`card-totals-${tot.currency}`}>
      <div className="flex items-baseline justify-between pb-2">
        <p className="eyebrow">{t('Monthly plan', 'الخطة الشهرية')} · {tot.currency}</p>
        <span className="type-caption rounded-full bg-primary-soft px-2 py-0.5 text-gold-ink">{t('Estimate', 'تقدير')}</span>
      </div>
      <dl className="divide-y divide-divider">
        <Term label={t('Expected income', 'الدخل المتوقع')} op=" "><MoneyDisplay value={tot.expectedIncome} size="sm" tone="projected" testId={`text-income-${tot.currency}`} /></Term>
        <Term label={t('Planned expenses', 'المصاريف المخططة')} op="−"><MoneyDisplay value={tot.plannedExpenses} size="sm" tone="planned" testId={`text-expenses-${tot.currency}`} /></Term>
        <Term label={t('Planned savings', 'الادخار المخطط')} op="−"><MoneyDisplay value={tot.plannedSavings} size="sm" tone="planned" testId={`text-savings-${tot.currency}`} /></Term>
      </dl>
      <div className="mt-2 border-t-2 border-foreground/80 pt-3">
        <p className="type-caption text-muted-foreground">= {t('Projected remaining', 'المتبقي المتوقع')}</p>
        <p className={cn('pt-1', neg && 'text-destructive')} data-testid={`text-remaining-${tot.currency}`}>
          {neg ? <span className="figure-hero">−</span> : null}
          <MoneyDisplay value={{ minor: Math.abs(tot.projectedRemaining.minor), currency: tot.projectedRemaining.currency }} size="hero" className={neg ? '!text-destructive' : ''} />
        </p>
        {neg ? <p className="type-caption pt-2 text-destructive">{t('Planned outflow exceeds expected income in this currency.', 'التدفق المخطط يتجاوز الدخل المتوقع في هذه العملة.')}</p> : null}
      </div>
    </div>
  );
}

export function PolicyPanel({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const h = plan.housing;
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-primary-soft p-4 md:p-5" data-testid="panel-policy">
      <p className="type-label">{t('How this plan is built', 'كيف تُبنى هذه الخطة')}</p>
      <ol className="type-caption flex list-decimal flex-col gap-1 ps-5 text-foreground">
        <li>{t('Manual plan lines win for their category and currency.', 'البنود اليدوية لها الأولوية في فئتها وعملتها.')}</li>
        <li>{t('Otherwise active recurring expenses (normalized monthly).', 'وإلا المصاريف المتكررة النشطة (محوّلة شهرياً).')}</li>
        <li>{t('Otherwise your profile baseline: housing (your share, else rent), utilities, internet and commute.', 'وإلا أساس ملفك: السكن (حصتك، وإلا الإيجار)، الخدمات، الإنترنت، والتنقل.')}</li>
        <li>{t('Budget limits are comparisons only and are never added as expenses.', 'حدود الميزانية للمقارنة فقط ولا تُضاف كمصاريف.')}</li>
        <li>{t('No currency conversion. Nothing here posts to your ledger.', 'لا تحويل عملات. لا شيء هنا يُسجَّل في دفترك.')}</li>
      </ol>
      {h ? <p className="type-caption text-muted-foreground">{t('Housing type', 'نوع السكن')}: {lbl({ family: ['Family', 'العائلة'], university_housing: ['University housing', 'سكن جامعي'], shared: ['Shared', 'مشترك'], private: ['Private', 'خاص'], other: ['Other', 'أخرى'] }, h.type, t)}</p> : null}
    </div>
  );
}

export function CostSources({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  return (
    <Collapsible className="rounded-xl border border-card-border" data-testid="panel-sources">
      <CollapsibleTrigger className="group type-label flex min-h-12 w-full items-center justify-between gap-3 px-4 text-start" data-testid="button-toggle-sources">
        {t(`Show the math · ${plan.costs.length} expense source${plan.costs.length === 1 ? '' : 's'}`, `اعرض الحساب · مصادر المصاريف: ${plan.costs.length}`)}
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-divider px-4 pb-4">
        {plan.costs.length === 0 ? <p className="type-caption py-3 text-muted-foreground">{t('No planned expenses yet. Add lines, recurring expenses or housing and commute details in your profile.', 'لا مصاريف مخططة بعد. أضف بنوداً أو مصاريف متكررة أو تفاصيل السكن والتنقل في ملفك.')}</p> : (
          <table className="w-full text-start">
            <thead><tr className="type-caption text-muted-foreground"><th className="py-2 text-start font-medium">{t('Category', 'الفئة')}</th><th className="py-2 text-start font-medium">{t('Source used', 'المصدر المستخدم')}</th><th className="py-2 text-end font-medium">{t('Monthly', 'شهري')}</th></tr></thead>
            <tbody className="divide-y divide-divider">
              {plan.costs.map((c, i) => (
                <tr key={`${c.category}-${c.amount.currency}-${c.source}-${i}`} className="type-label" data-testid={`row-cost-${c.category}-${c.amount.currency}`}>
                  <td className="py-2">{lbl(CATEGORY, c.category, t)}</td>
                  <td className="py-2 text-muted-foreground">{lbl(COST_SOURCE, c.source, t)}</td>
                  <td className="py-2 text-end"><MoneyDisplay value={c.amount} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {plan.income.length ? (
          <div className="pt-4">
            <p className="type-caption pb-1 font-medium">{t('Income normalization', 'تحويل الدخل')}</p>
            <p className="type-caption text-muted-foreground">{t('Each recurring source × occurrences per year (daily 365, weekly 52, biweekly 26, monthly 12, quarterly 4, yearly 1) ÷ 12. Totals are summed exactly and rounded once per currency; displayed source estimates may differ by a minor unit when added.', 'كل مصدر متكرر × مرات السنة (يومي 365، أسبوعي 52، كل أسبوعين 26، شهري 12، ربع سنوي 4، سنوي 1) ÷ 12. تُجمع القيم بدقة وتُقرّب مرة واحدة لكل عملة؛ قد يختلف جمع تقديرات المصادر المعروضة بجزء من العملة.')}</p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Goal forecast extension: effective savings = max(manual envelope, dated goal requirements) per currency — never their sum. */
export function GoalSavingsPanel({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const rows = plan.goalSavings ?? [];
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-4 md:p-5" data-testid="panel-goal-savings">
      <p className="type-label">{t('Savings: manual plan vs goal requirements', 'الادخار: الخطة اليدوية مقابل متطلبات الأهداف')}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const goalsWin = r.goalRequired.minor > r.manualSavings.minor;
          return (
            <dl key={r.currency} className="divide-y divide-divider" data-testid={`card-goal-savings-${r.currency}`}>
              <Term label={`${t('Manual savings lines', 'بنود الادخار اليدوية')} · ${r.currency}`}><MoneyDisplay value={r.manualSavings} size="sm" tone="planned" /></Term>
              <Term label={t('Dated goals require', 'تتطلب الأهداف المؤرخة')}><MoneyDisplay value={r.goalRequired} size="sm" tone="planned" /></Term>
              <Term label={t('Counted in plan (the larger)', 'المحتسب في الخطة (الأكبر)')}><MoneyDisplay value={r.effectiveSavings} size="sm" tone="highlight" testId={`text-effective-savings-${r.currency}`} /></Term>
              <p className="type-caption pt-2 text-muted-foreground">{goalsWin ? t('Your goals need more than your manual savings lines, so the goal requirement sets the floor.', 'أهدافك تحتاج أكثر من بنود الادخار اليدوية، لذا يحدد متطلب الأهداف الحد الأدنى.') : t('Your manual savings already cover your goals, so they aren’t added twice.', 'ادخارك اليدوي يغطي أهدافك، لذا لا يُحتسبان مرتين.')}
                {r.undatedActiveCount > 0 ? ` ${t(`${r.undatedActiveCount} active goal(s) without a date aren’t forecast.`, `${r.undatedActiveCount} هدف نشط بلا تاريخ غير متوقع.`)}` : ''}</p>
            </dl>
          );
        })}
      </div>
    </div>
  );
}
