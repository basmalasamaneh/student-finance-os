import { Link } from 'wouter';
import type { FinancialPlan } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { SectionHeading } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { FREQUENCY, INCOME_SOURCE, formatUtcDate, lbl } from '@/features/planning/planning-model';
import { EmptyRow } from './plan-shared';

const UPCOMING_SRC: Record<string, [string, string]> = { income: ['Expected income', 'دخل متوقع'], recurring: ['Recurring expense', 'مصروف متكرر'], line: ['Plan line', 'بند خطة'] };

export function IncomeSection({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const { locale } = useI18n();
  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="income-title" data-testid="section-income">
      <SectionHeading id="income-title" title={t('Expected income', 'الدخل المتوقع')} meta={t('Estimate · not guaranteed', 'تقدير · غير مضمون')}
        trailing={<Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-edit-income">{t('Edit income in profile', 'عدّل الدخل في الملف')}</Link>} />
      {plan.income.length === 0 ? (
        <EmptyRow title={t('No recurring income', 'لا دخل متكرر')} body={t('Your plan shows zero expected income because none is saved. Nothing is invented.', 'تُظهر خطتك دخلاً متوقعاً صفراً لعدم وجود دخل محفوظ. لا شيء مُختلق.')} />
      ) : (
        <ul className="divide-y divide-divider">
          {plan.income.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 py-3" data-testid={`row-income-${i.id}`}>
              <div className="min-w-0">
                <p className="type-label">{lbl(INCOME_SOURCE, i.source, t)}</p>
                <p className="type-caption text-muted-foreground">{i.stability === 'stable' ? t('Stable', 'ثابت') : t('Variable estimate — not guaranteed', 'تقدير متغير — غير مضمون')}</p>
              </div>
              <span className="type-caption text-muted-foreground">{t('per month', 'شهرياً')} <MoneyDisplay value={i.monthlyEstimate} size="sm" tone="projected" /></span>
            </li>
          ))}
        </ul>
      )}

      {plan.irregularIncome.length ? (
        <div className="pt-5">
          <h3 className="type-caption pb-1 font-medium uppercase tracking-wide text-gold-ink">{t('One-time & irregular — not in monthly total', 'لمرة واحدة وغير منتظم — خارج المجموع الشهري')}</h3>
          <ul className="divide-y divide-divider">
            {plan.irregularIncome.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-3" data-testid={`row-irregular-${i.id}`}>
                <div className="min-w-0">
                  <p className="type-label">{lbl(INCOME_SOURCE, i.source, t)}</p>
                  <p className="type-caption text-muted-foreground">{lbl(FREQUENCY, i.frequency, t)}{i.expectedDate ? ` · ${formatUtcDate(i.expectedDate, locale)}` : ` · ${t('no date', 'بلا تاريخ')}`}</p>
                  {i.description ? <p className="type-caption break-words text-muted-foreground" dir="auto">{i.description}</p> : null}
                </div>
                <MoneyDisplay value={i.amount} size="sm" tone="projected" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.scholarships.length ? (
        <div className="pt-5">
          <h3 className="type-caption pb-1 font-medium uppercase tracking-wide text-gold-ink">{t('Scholarships (profile details)', 'المنح (تفاصيل الملف)')}</h3>
          <p className="type-caption pb-2 text-muted-foreground">{t('Shown for reference. Only scholarship income sources count — never added twice.', 'للعرض فقط. تُحتسب مصادر دخل المنح فقط — دون تكرار.')}</p>
          <ul className="flex flex-wrap gap-2">
            {plan.scholarships.map((s) => (
              <li key={s.id} className="type-caption rounded-full border border-card-border px-3 py-1" data-testid={`chip-scholarship-${s.id}`}>
                <span dir="auto">{s.name}</span>{s.provider ? <span className="text-muted-foreground" dir="auto"> · {s.provider}</span> : null}
                {s.percentage != null ? <span className="text-muted-foreground"> · {s.percentage}%</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function UpcomingSection({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const { locale } = useI18n();
  const items = [...plan.upcoming].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="upcoming-title" data-testid="section-plan-upcoming">
      <SectionHeading id="upcoming-title" title={t('Upcoming', 'القادم')} meta={t('Planned dates — nothing is charged automatically', 'تواريخ مخططة — لا يُخصم شيء تلقائياً')} />
      {items.length === 0 ? <p className="type-caption text-muted-foreground">{t('No dated items yet. Recurring expenses, dated lines and dated income appear here.', 'لا بنود مؤرخة بعد. تظهر هنا المصاريف المتكررة والبنود والدخل المؤرخ.')}</p> : (
        <ul className="divide-y divide-divider">
          {items.map((u) => (
            <li key={`${u.source}-${u.id}-${u.date}`} className="flex items-center gap-4 py-3" data-testid={`row-upcoming-${u.id}`}>
              <span className="type-caption w-24 shrink-0 tabular text-muted-foreground">{formatUtcDate(u.date, locale)}</span>
              <div className="min-w-0 flex-1">
                <p className="type-label break-words" dir="auto">{u.description || lbl(UPCOMING_SRC, u.source, t)}</p>
                <p className="type-caption text-muted-foreground">{lbl(UPCOMING_SRC, u.source, t)}</p>
              </div>
              <MoneyDisplay value={u.amount} size="sm" tone={u.source === 'income' ? 'projected' : 'planned'} showPlus={u.source === 'income'} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
