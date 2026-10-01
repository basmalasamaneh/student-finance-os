import { useMemo, useState } from 'react';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { useDeviceSecurity } from '@/features/security/device-security';
import { Link } from 'wouter';
import { ArrowUpRight, HandCoins, Lightbulb, Plus, ShoppingBag } from 'lucide-react';
import { MovementDialog } from '@/components/money/movement-dialog';
import { RequestDialog } from '@/components/money/request-dialog';
import { getGetFinanceSummaryQueryKey, getListFinanceAccountsQueryKey, useGetFinanceSummary, useListFinanceAccounts, type Profile } from '@workspace/api-client-react';
import { AccountsBlock, ActualIncomeSpending, BalanceBlock, LedgerBlock, RequestsBlock } from './finance-blocks';
import { EstimateList, HomeBlock, type T } from './home-primitives';
import { GoalsHomeBlock } from './goals-block';
import { PlanTotalsBlock } from './plan-totals-block';
import { UniversityContext } from './university-context';
import { SchoolLinks } from './school-links';
import { InsightText, SchoolPlanning, UniversityPlanning } from './planning-panels';
import { UpcomingHomeList } from './upcoming-block';
import { applyAllowanceAdjustment, deriveInsight, estimateMonthlyIncome, localToday, type HomeIncome } from '@/features/home/student-home-model';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·';
}
const qaCls = 'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-gold-50/30 px-1 py-2 text-center transition-[transform,background-color] hover:bg-gold-50/45 active:scale-[.97] md:min-h-11';

export function StudentDashboard({ profile, name, t }: { profile: Profile; name: string; t: T }) {
  // Shared device preference (Security settings) — replaces the old Home-only local toggle.
  const { hideBalances: hidden, setHideBalances } = useDeviceSecurity();
  const toggleHidden = () => setHideBalances(!hidden);
  const [movement, setMovement] = useState<'add' | 'send' | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const summary = useGetFinanceSummary({ query: { queryKey: getGetFinanceSummaryQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const accounts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const today = localToday();
  const incomes = profile.incomes as HomeIncome[];
  const e = profile.education;
  const isSchool = e?.studentType === 'school';
  const projection = profile.allowanceProjection;
  const estimate = useMemo(() => applyAllowanceAdjustment(estimateMonthlyIncome(incomes), projection?.totals), [incomes, projection]);
  const adjusted = estimate.byCurrency.some((c) => c.allowanceAdjustment);
  const insight = useMemo(() => deriveInsight({
    studentType: e?.studentType, incomes, commuteMonthly: profile.commute?.monthlyEstimate,
    housingShare: profile.residence?.studentShare, allowance: e?.typicalAllowance, allowanceFrequency: e?.allowanceFrequency,
  }), [e, incomes, profile.commute, profile.residence]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('Good morning', 'صباح الخير') : hour < 18 ? t('Good afternoon', 'مساء الخير') : t('Good evening', 'مساء الخير');
  const institution = isSchool ? e?.school : e?.university;

  // Pull-to-refresh re-runs the real queries; nothing is shown until the server answers.
  const refresh = () => Promise.all([summary.refetch(), accounts.refetch()]);

  return (
    <PullToRefresh onRefresh={refresh} label={t('Refreshing…', 'جارٍ التحديث…')}>
    <div className="stagger flex flex-col">
      {/* 1 Greeting */}
      <header className="flex flex-col gap-2 pb-6 md:pb-10" data-testid="section-greeting">
        <p className="eyebrow">{institution ? `${institution}${!isSchool && e?.campus ? ` · ${e.campus}` : ''}` : t('YOUR SPACE', 'مساحتك')}</p>
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold-200 bg-primary-soft text-base font-semibold text-gold-ink dark:border-gold-800" aria-hidden data-testid="avatar-initials">{initials(name)}</span><h1 className="type-display min-w-0 break-words" data-testid="text-page-title">{greet}, {name}</h1></div>
        <p className="type-body max-w-2xl text-muted-foreground">{t('Your plan, built from what you told us. Money figures marked ≈ are estimates, not balances.', 'خطتك مبنية مما أخبرتنا به. الأرقام المعلّمة بـ ≈ تقديرات وليست أرصدة.')}</p>
        <div className="pt-2"><Link href="/profile" className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary" data-testid="link-edit-profile">{t('Edit profile', 'تعديل الملف')}</Link></div>
      </header>

      {/* 2 Available balance + 3 Total accounts */}
      <div className="grid grid-cols-1 gap-x-12 border-t border-divider md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <HomeBlock id="balance" title={t('Available balance', 'الرصيد المتاح')} className="border-t-0">
          <BalanceBlock summary={summary} t={t} hidden={hidden} onToggleHidden={toggleHidden} accountCount={accounts.data?.length}
            actions={accounts.data?.length ? <nav aria-label={t('Quick actions', 'إجراءات سريعة')} className={isSchool ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-4 gap-2'}>
              <button type="button" className={qaCls} onClick={() => setMovement('add')} data-testid="button-quick-add"><Plus className="size-5" aria-hidden /><span className="type-caption font-medium">{t('Add money', 'إضافة مال')}</span></button>
              <button type="button" className={qaCls} onClick={() => setMovement('send')} data-testid="button-quick-send"><ArrowUpRight className="size-5" aria-hidden /><span className="type-caption font-medium">{t('Send', 'إرسال')}</span></button>
              <button type="button" className={qaCls} onClick={() => setRequestOpen(true)} data-testid="button-quick-request"><HandCoins className="size-5" aria-hidden /><span className="type-caption font-medium">{t('Request', 'طلب')}</span></button>
              {isSchool ? null : <Link href="/campus" className={qaCls} data-testid="link-quick-campus"><ShoppingBag className="size-5" aria-hidden /><span className="type-caption font-medium">{t('Pay campus', 'دفع في الحرم')}</span></Link>}
            </nav> : undefined} />
        </HomeBlock>
        <HomeBlock id="accounts" title={t('Total accounts', 'إجمالي الحسابات')} meta={accounts.data ? t(`${accounts.data.length} total`, `${accounts.data.length} حساب`) : undefined} className="md:border-t-0">
          <AccountsBlock accounts={accounts} t={t} />
        </HomeBlock>
      </div>

      {/* 4 Monthly income + 5 Monthly spending */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-x-12 md:overflow-visible md:px-0" data-testid="scroller-income-spending">
        <HomeBlock className="w-[85%] shrink-0 snap-start max-md:rounded-card max-md:border max-md:bg-card max-md:px-4 max-md:mt-6 md:w-auto" id="monthly-income" title={t('Monthly income', 'الدخل الشهري')} meta={t('Received · plan', 'مستلم · خطة')}>
          <div className="pb-3"><p className="type-caption pb-1 text-muted-foreground">{t('Received this month (ledger)', 'المستلم هذا الشهر (السجل)')}</p><ActualIncomeSpending summary={summary} kind="income" t={t} /></div>
          <p className="type-caption pb-1 text-muted-foreground">{t('Planning estimate (profile)', 'تقدير تخطيطي (الملف)')}</p>
          {estimate.byCurrency.length ? <EstimateList items={estimate.byCurrency} t={t} testId="text-monthly-income" />
            : <p className="type-label">{estimate.activeCount ? t('No recurring income to estimate', 'لا دخل متكرر للتقدير') : t('No active income saved', 'لا يوجد دخل نشط محفوظ')}</p>}
          {adjusted && <p className="type-caption pt-2 text-muted-foreground" data-testid="text-allowance-envelope">{t('Includes scheduled parent allowances. Your plan counts the larger of the allowance in your profile or the schedules — never both.', 'يشمل مصروفات ولي الأمر المجدولة. تحتسب خطتك الأكبر بين المصروف في ملفك أو الجداول — لا كليهما.')} <Link href="/family" className="text-gold-ink underline-offset-4 hover:underline" data-testid="link-allowance-details">{t('Details', 'التفاصيل')}</Link></p>}
          {estimate.excluded > 0 && <p className="type-caption pt-2 text-muted-foreground">{t(`${estimate.excluded} one-time or irregular source${estimate.excluded === 1 ? '' : 's'} not included.`, `مصادر لمرة واحدة أو غير منتظمة غير مشمولة: ${estimate.excluded}`)}</p>}
          {!estimate.activeCount && <Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-add-income">{t('Add income sources', 'أضف مصادر دخل')}</Link>}
        </HomeBlock>
        <HomeBlock className="w-[85%] shrink-0 snap-start max-md:rounded-card max-md:border max-md:bg-card max-md:px-4 max-md:mt-6 md:w-auto" id="monthly-spending" title={t('Monthly spending', 'الإنفاق الشهري')}>
          <ActualIncomeSpending summary={summary} kind="spending" t={t} />
        </HomeBlock>
      </div>

      {/* 6 Upcoming */}
      <HomeBlock id="upcoming" title={t('Upcoming', 'القادم')}>
        <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
          <div><p className="type-caption pb-1 text-muted-foreground">{t('Pending money requests', 'طلبات مال معلّقة')}</p><RequestsBlock summary={summary} t={t} /></div>
          <div><p className="type-caption pb-1 text-muted-foreground">{t('Next 30 days · estimated', 'الأيام الثلاثون القادمة · تقديري')}</p><UpcomingHomeList t={t} hidden={hidden} /></div>
        </div>
      </HomeBlock>

      {/* Profile-specific planning */}
      {e ? isSchool
        ? <><SchoolLinks t={t} /><SchoolPlanning profile={profile} incomes={incomes} today={today} summary={summary} t={t} /></>
        : <><UniversityPlanning profile={profile} t={t} hidden={hidden} /><UniversityContext profile={profile} t={t} /></>
        : null}

      <PlanTotalsBlock t={t} />

      {/* 7 Savings, 8 Campus */}
      <div className={isSchool ? 'grid grid-cols-1' : 'grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
        <HomeBlock id="savings" title={t('Savings goals', 'أهداف الادخار')}>
          <GoalsHomeBlock t={t} />
        </HomeBlock>
        {isSchool ? null : <HomeBlock id="campus" title={t('Campus activity', 'نشاط الحرم')}>
          <LedgerBlock summary={summary} which="campus" t={t} />
        </HomeBlock>}
      </div>

      {/* 9 Insight */}
      <HomeBlock id="insight" title={t('Financial insight', 'ملاحظة مالية')} meta={t('From your profile only', 'من ملفك فقط')}>
        <div className="flex items-start gap-3 rounded-card bg-primary-soft p-4 md:p-5" data-testid="text-insight">
          <Lightbulb className="mt-1 size-4 shrink-0 text-gold-ink" aria-hidden />
          <p className="type-body text-foreground"><InsightText insight={insight} t={t} /></p>
        </div>
      </HomeBlock>

      {/* 10 Recent transactions */}
      <HomeBlock id="transactions" title={t('Recent transactions', 'أحدث الحركات')}>
        <LedgerBlock summary={summary} which="recent" t={t} />
      </HomeBlock>
      <MovementDialog kind={movement ?? 'add'} open={!!movement} onOpenChange={(o) => { if (!o) setMovement(null); }} accounts={accounts.data ?? []} t={t} />
      <RequestDialog open={requestOpen} onOpenChange={setRequestOpen} accounts={accounts.data ?? []} t={t} />
    </div>
    </PullToRefresh>
  );
}
