import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Page, SectionHeading, SpecimenTag } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { BalanceDisplay } from '@/components/finance/balance-display';
import { FinancialSummary } from '@/components/finance/financial-summary';
import { ProgressMeter } from '@/components/finance/progress-meter';
import { UpcomingPayment } from '@/components/finance/upcoming-payment';
import { TransactionRow } from '@/components/finance/transaction-row';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/features/theme/theme-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import { HOME_SPECIMEN as S } from '@/features/specimens/home-specimen';
import { formatDate, formatMoney } from '@/lib/money';

/**
 * DESIGN-REFERENCE HOME. Demonstrates the intended hierarchy of a future
 * financial home using the static HOME_SPECIMEN fixture. It is not a dashboard:
 * nothing is fetched, computed or moved.
 */
export default function HomePage() {
  const { t, lang, locale } = useI18n();
  const { theme, resolved } = useTheme();
  const { role } = usePreview();
  const { toast } = useToast();
  const example = <SpecimenTag label={t('hs.example')} />;
  const specimenToast = () => toast({ title: t('hs.act.toast'), description: t('hs.act.toastBody') });

  return (
    <Page className="max-w-6xl">
      {/* Reference banner — first thing read, impossible to miss. */}
      <aside
        aria-label={t('hs.banner')}
        className="motion-fade mb-10 flex flex-col gap-3 border-b border-dashed border-input pb-5 sm:flex-row sm:items-center sm:justify-between md:mb-14"
        data-testid="banner-design-reference"
      >
        <p className="flex max-w-3xl flex-col gap-1 text-sm leading-6 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="flex shrink-0 items-center gap-2 font-semibold text-gold-ink">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {t('hs.banner')}
          </span>
          <span className="text-muted-foreground">{t('hs.bannerBody')}</span>
        </p>
        <Link href="/foundation" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline decoration-gold-ink/40 underline-offset-4 hover:decoration-gold-ink" data-testid="link-cta-foundation">
          {t('hs.bannerLink')}
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      </aside>

      {/* Greeting + dominant balance */}
      <header className="stagger flex flex-col gap-8 pb-12 md:pb-16">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]" data-testid="text-page-title">{t('hs.greeting')}</h1>
          <p className="text-[15px] text-muted-foreground">{t('hs.context')}</p>
        </div>
        <BalanceDisplay
          label={t('hs.balanceLabel')}
          amount={S.balance}
          tag={example}
          testId="text-specimen-balance"
          note={t('hs.balanceNote', { date: formatDate(S.nextAllowance, locale), amount: formatMoney(S.projectedRemaining, locale) })}
          actions={
            <>
              <Button size="lg" onClick={specimenToast} data-testid="button-home-plan">{t('hs.act.plan')}</Button>
              <Button size="lg" variant="secondary" onClick={specimenToast} data-testid="button-home-save">{t('hs.act.save')}</Button>
              <Button size="lg" variant="ghost" disabled aria-describedby="pay-note" data-testid="button-home-pay">{t('hs.act.pay')}</Button>
              <span id="pay-note" className="basis-full text-[13px] text-muted-foreground">{t('hs.act.payNote')}</span>
            </>
          }
        />
      </header>

      {/* Open sections: two columns on desktop, one reading column on mobile. No cards. */}
      <div className="grid gap-x-14 gap-y-12 border-t border-divider pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:pt-12">
        <div className="flex flex-col gap-12">
          <section aria-labelledby="hs-period">
            <SectionHeading id="hs-period" title={t('hs.period')} meta={t('hs.periodRange')} trailing={example} />
            <FinancialSummary
              testId="summary-home-period"
              items={[
                { id: 'spent', label: t('hs.spent'), value: S.period.spent },
                { id: 'planned', label: t('hs.planned'), value: S.period.planned, tone: 'planned' },
                { id: 'left', label: t('hs.left'), value: S.period.left, tone: 'highlight' },
              ]}
            />
            <div className="pt-6">
              <ProgressMeter
                kind="budget"
                value={S.period.used}
                label={t('hs.budget')}
                status="on"
                statusLabel={t('fd.progress.on')}
                detail={
                  <span className="flex items-baseline gap-2">
                    {t('hs.projected')} <MoneyDisplay value={S.period.projected} tone="projected" size="sm" />
                  </span>
                }
              />
            </div>
          </section>

          <section aria-labelledby="hs-activity">
            <SectionHeading id="hs-activity" title={t('hs.activity')} trailing={example} />
            <ul className="divide-y divide-divider border-y border-divider">
              {S.activity.map((a) => (
                <TransactionRow
                  key={a.id}
                  title={t(a.title)}
                  meta={t(a.meta)}
                  amount={a.amount}
                  date={a.date}
                  direction={a.direction}
                  directionLabel={t(a.direction === 'in' ? 'fd.txn.in' : a.direction === 'out' ? 'fd.txn.out' : 'fd.txn.cMeta')}
                  testId={`row-home-activity-${a.id}`}
                />
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-12 lg:border-s lg:border-divider lg:ps-14">
          <section aria-labelledby="hs-upcoming">
            <SectionHeading id="hs-upcoming" title={t('hs.upcoming')} trailing={example} />
            <ul className="divide-y divide-divider border-y border-divider">
              {S.upcoming.map((u) => (
                <UpcomingPayment key={u.id} title={t(u.title)} meta={t(u.meta)} due={u.due} amount={u.amount} statusTone={u.tone} statusLabel={t(u.status)} testId={`row-home-upcoming-${u.id}`} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="hs-savings">
            <SectionHeading id="hs-savings" title={t('hs.savings')} trailing={example} />
            <div className="flex flex-col gap-7 border-t border-divider pt-5">
              {S.savings.map((g) => (
                <ProgressMeter
                  key={g.id}
                  kind="savings"
                  value={g.ratio}
                  label={t(g.name)}
                  status={g.ratio >= 0.8 ? 'near' : 'on'}
                  statusLabel={t(g.ratio >= 0.8 ? 'fd.progress.near' : 'fd.progress.on')}
                  detail={t('hs.sv.of', { saved: formatMoney(g.saved, locale), target: formatMoney(g.target, locale) })}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* About this build — honest context, quietly at the end. */}
      <footer className="mt-16 grid gap-8 border-t border-divider pt-10 md:grid-cols-3" aria-labelledby="hs-foot">
        <div className="flex flex-col gap-3">
          <h2 id="hs-foot" className="text-[15px] font-semibold">{t('hs.foot')}</h2>
          <dl className="flex flex-col gap-1.5 text-sm" data-testid="text-foundation-context">
            <div className="flex gap-2"><dt className="text-muted-foreground">{t('home.meta.language')}</dt><dd className="font-medium">{lang === 'ar' ? t('lang.arabic') : t('lang.english')}</dd></div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t('home.meta.theme')}</dt>
              <dd className="font-medium">{t(`theme.${theme}`)}{theme === 'system' ? <span className="text-muted-foreground"> · {t(`theme.${resolved}`)}</span> : null}</dd>
            </div>
            <div className="flex gap-2"><dt className="text-muted-foreground">{t('home.meta.preview')}</dt><dd className="font-medium">{t(`role.${role}`)}</dd></div>
          </dl>
          <Link href="/appearance" className="inline-flex min-h-11 w-fit items-center text-sm font-medium underline decoration-gold-ink/40 underline-offset-4 hover:decoration-gold-ink" data-testid="link-cta-appearance">
            {t('home.cta.appearance')}
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">{t('home.statusNext')}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{t('home.next.body')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">{t('home.statusNot')}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{t('home.not.body')}</p>
        </div>
      </footer>
    </Page>
  );
}
