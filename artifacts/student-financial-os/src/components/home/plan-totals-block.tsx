import { Link } from 'wouter';
import { MoneyDisplay } from '@/components/finance/money-display';
import { usePlan } from '@/features/planning/planning-model';
import { HomeBlock, type T } from './home-primitives';

/** Home summary of server plan totals — no client recomputation. */
export function PlanTotalsBlock({ t }: { t: T }) {
  const plan = usePlan();
  const link = <Link href="/plan" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-open-plan">{t('Open plan', 'افتح الخطة')}</Link>;
  return (
    <HomeBlock id="plan-totals" title={t('Monthly plan', 'الخطة الشهرية')} meta={t('Estimate', 'تقدير')}>
      {plan.isLoading ? <div className="skeleton-shimmer h-12 rounded-lg" /> : plan.isError || !plan.data ? (
        <p className="type-caption text-muted-foreground">{t('Plan totals could not load.', 'تعذّر تحميل مجاميع الخطة.')} <button type="button" className="text-gold-ink underline" onClick={() => void plan.refetch()} data-testid="button-retry-plan-home">{t('Retry', 'أعد المحاولة')}</button></p>
      ) : plan.data.totals.length === 0 ? (
        <p className="type-caption text-muted-foreground">{t('Nothing planned yet.', 'لا شيء مخطط بعد.')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plan.data.totals.map((tot) => {
            const neg = tot.projectedRemaining.minor < 0;
            return (
              <li key={tot.currency} className="flex flex-wrap items-baseline justify-between gap-x-4" data-testid={`text-home-remaining-${tot.currency}`}>
                <span className="type-caption text-muted-foreground">{t('Projected remaining', 'المتبقي المتوقع')} · {tot.currency}</span>
                <span className={neg ? 'text-destructive' : ''}>{neg ? '−' : ''}<MoneyDisplay value={{ minor: Math.abs(tot.projectedRemaining.minor), currency: tot.projectedRemaining.currency }} size="md" className={neg ? '!text-destructive' : ''} /></span>
              </li>
            );
          })}
        </ul>
      )}
      {link}
    </HomeBlock>
  );
}
