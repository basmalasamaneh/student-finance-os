import { useMemo } from 'react';
import { Link } from 'wouter';
import { Lightbulb } from 'lucide-react';
import { getGetFinanceSummaryQueryKey, getListFinanceAccountsQueryKey, useGetFinanceSummary, useListFinanceAccounts, type Profile } from '@workspace/api-client-react';
import { AccountsBlock, ActualIncomeSpending, BalanceBlock, LedgerBlock, RequestsBlock } from './finance-blocks';
import { EstimateList, HomeBlock, Unavailable, type T } from './home-primitives';
import { PlanTotalsBlock } from './plan-totals-block';
import { InsightText, SchoolPlanning, UniversityPlanning, UpcomingIncomeList } from './planning-panels';
import { deriveInsight, estimateMonthlyIncome, localToday, upcomingIncomes, type HomeIncome } from '@/features/home/student-home-model';

export function StudentDashboard({ profile, name, t }: { profile: Profile; name: string; t: T }) {
  const summary = useGetFinanceSummary({ query: { queryKey: getGetFinanceSummaryQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const accounts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const today = localToday();
  const incomes = profile.incomes as HomeIncome[];
  const e = profile.education;
  const isSchool = e?.studentType === 'school';
  const estimate = useMemo(() => estimateMonthlyIncome(incomes), [incomes]);
  const upcoming = useMemo(() => upcomingIncomes(incomes, today), [incomes, today]);
  const insight = useMemo(() => deriveInsight({
    studentType: e?.studentType, incomes, commuteMonthly: profile.commute?.monthlyEstimate,
    housingShare: profile.residence?.studentShare, allowance: e?.typicalAllowance, allowanceFrequency: e?.allowanceFrequency,
  }), [e, incomes, profile.commute, profile.residence]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('Good morning', 'صباح الخير') : hour < 18 ? t('Good afternoon', 'مساء الخير') : t('Good evening', 'مساء الخير');
  const institution = isSchool ? e?.school : e?.university;

  return (
    <div className="stagger flex flex-col">
      {/* 1 Greeting */}
      <header className="flex flex-col gap-2 pb-6 md:pb-10" data-testid="section-greeting">
        <p className="eyebrow">{institution ? `${institution}${!isSchool && e?.campus ? ` · ${e.campus}` : ''}` : t('YOUR SPACE', 'مساحتك')}</p>
        <h1 className="type-display break-words" data-testid="text-page-title">{greet}, {name}</h1>
        <p className="type-body max-w-2xl text-muted-foreground">{t('Your plan, built from what you told us. Money figures marked ≈ are estimates, not balances.', 'خطتك مبنية مما أخبرتنا به. الأرقام المعلّمة بـ ≈ تقديرات وليست أرصدة.')}</p>
        <div className="pt-2"><Link href="/profile" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover" data-testid="link-edit-profile">{t('Edit profile', 'تعديل الملف')}</Link></div>
      </header>

      {/* 2 Available balance + 3 Total accounts */}
      <div className="grid grid-cols-1 gap-x-12 border-t border-divider md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <HomeBlock id="balance" title={t('Available balance', 'الرصيد المتاح')} className="border-t-0">
          <BalanceBlock summary={summary} t={t} />
        </HomeBlock>
        <HomeBlock id="accounts" title={t('Total accounts', 'إجمالي الحسابات')} meta={accounts.data ? t(`${accounts.data.length} total`, `${accounts.data.length} حساب`) : undefined} className="md:border-t-0">
          <AccountsBlock accounts={accounts} t={t} />
        </HomeBlock>
      </div>

      {/* 4 Monthly income + 5 Monthly spending */}
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <HomeBlock id="monthly-income" title={t('Monthly income', 'الدخل الشهري')} meta={t('Received · plan', 'مستلم · خطة')}>
          <div className="pb-3"><p className="type-caption pb-1 text-muted-foreground">{t('Received this month (ledger)', 'المستلم هذا الشهر (السجل)')}</p><ActualIncomeSpending summary={summary} kind="income" t={t} /></div>
          <p className="type-caption pb-1 text-muted-foreground">{t('Planning estimate (profile)', 'تقدير تخطيطي (الملف)')}</p>
          {estimate.byCurrency.length ? <EstimateList items={estimate.byCurrency} t={t} testId="text-monthly-income" />
            : <p className="type-label">{estimate.activeCount ? t('No recurring income to estimate', 'لا دخل متكرر للتقدير') : t('No active income saved', 'لا يوجد دخل نشط محفوظ')}</p>}
          {estimate.excluded > 0 && <p className="type-caption pt-2 text-muted-foreground">{t(`${estimate.excluded} one-time or irregular source${estimate.excluded === 1 ? '' : 's'} not included.`, `مصادر لمرة واحدة أو غير منتظمة غير مشمولة: ${estimate.excluded}`)}</p>}
          {!estimate.activeCount && <Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-add-income">{t('Add income sources', 'أضف مصادر دخل')}</Link>}
        </HomeBlock>
        <HomeBlock id="monthly-spending" title={t('Monthly spending', 'الإنفاق الشهري')}>
          <ActualIncomeSpending summary={summary} kind="spending" t={t} />
        </HomeBlock>
      </div>

      {/* 6 Upcoming */}
      <HomeBlock id="upcoming" title={t('Upcoming payments', 'المدفوعات القادمة')}>
        <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
          <div><p className="type-caption pb-1 text-muted-foreground">{t('Pending money requests', 'طلبات مال معلّقة')}</p><RequestsBlock summary={summary} t={t} /></div>
          <div><p className="type-caption pb-1 text-muted-foreground">{t('Expected income (from profile)', 'الدخل المتوقع (من الملف)')}</p><UpcomingIncomeList items={upcoming} t={t} /></div>
        </div>
      </HomeBlock>

      {/* Profile-specific planning */}
      {e ? isSchool
        ? <SchoolPlanning profile={profile} incomes={incomes} today={today} t={t} />
        : <UniversityPlanning profile={profile} upcoming={upcoming} t={t} />
        : null}

      <PlanTotalsBlock t={t} />

      {/* 7 Savings, 8 Campus */}
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <HomeBlock id="savings" title={t('Savings goals', 'أهداف الادخار')}>
          <Unavailable testId="status-savings" label={t('No goals yet', 'لا أهداف بعد')} body={t('Savings goals are coming in a later release.', 'أهداف الادخار قادمة في إصدار لاحق.')} />
        </HomeBlock>
        <HomeBlock id="campus" title={t('Campus activity', 'نشاط الحرم')}>
          <LedgerBlock summary={summary} which="campus" t={t} />
        </HomeBlock>
      </div>

      {/* 9 Insight */}
      <HomeBlock id="insight" title={t('Financial insight', 'ملاحظة مالية')} meta={t('From your profile only', 'من ملفك فقط')}>
        <div className="flex items-start gap-3 rounded-xl bg-primary-soft p-4 md:p-5" data-testid="text-insight">
          <Lightbulb className="mt-1 size-4 shrink-0 text-gold-ink" aria-hidden />
          <p className="type-body text-foreground"><InsightText insight={insight} t={t} /></p>
        </div>
      </HomeBlock>

      {/* 10 Recent transactions */}
      <HomeBlock id="transactions" title={t('Recent transactions', 'أحدث الحركات')}>
        <LedgerBlock summary={summary} which="recent" t={t} />
      </HomeBlock>
    </div>
  );
}
