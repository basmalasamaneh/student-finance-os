import { useMemo } from 'react';
import { Link } from 'wouter';
import { Banknote, Building2, Lightbulb, Plus, Wallet } from 'lucide-react';
import type { Profile } from '@workspace/api-client-react';
import { EstimateList, HomeBlock, Unavailable, type T } from './home-primitives';
import { InsightText, SchoolPlanning, UniversityPlanning, UpcomingIncomeList } from './planning-panels';
import { deriveInsight, estimateMonthlyIncome, localToday, upcomingIncomes, type HomeIncome } from '@/features/home/student-home-model';

const ACCOUNT_TYPES = [
  { id: 'wallet', icon: Wallet, en: 'Student Wallet', ar: 'المحفظة الطلابية' },
  { id: 'bank', icon: Building2, en: 'Bank Account', ar: 'الحساب البنكي' },
  { id: 'cash', icon: Banknote, en: 'Cash', ar: 'النقد' },
  { id: 'other', icon: Plus, en: 'Other', ar: 'أخرى' },
] as const;

export function StudentDashboard({ profile, name, t }: { profile: Profile; name: string; t: T }) {
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
          <p className="figure-hero text-muted-foreground/60" aria-hidden>—</p>
          <p className="type-body mt-3 max-w-sm text-muted-foreground" data-testid="status-balance">{t('No accounts are connected, so there is no balance to show. We will not display a zero that isn’t real.', 'لا توجد حسابات مرتبطة، لذا لا يوجد رصيد. لن نعرض صفراً غير حقيقي.')}</p>
        </HomeBlock>
        <HomeBlock id="accounts" title={t('Total accounts', 'إجمالي الحسابات')} meta={t('None set up', 'لم يُعدّ أي حساب')} className="md:border-t-0">
          <ul className="divide-y divide-divider">
            {ACCOUNT_TYPES.map(({ id, icon: Icon, en, ar }) => (
              <li key={id} className="flex min-w-0 items-center gap-3 py-2.5" data-testid={`row-account-${id}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-input text-muted-foreground"><Icon className="size-4" aria-hidden /></span>
                <span className="type-label min-w-0 flex-1">{t(en, ar)}</span>
                <span className="type-caption rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{t('Not set up', 'غير مُعدّ')}</span>
              </li>
            ))}
          </ul>
          <p className="type-caption pt-2 text-muted-foreground">{t('Adding accounts arrives in a later release.', 'إضافة الحسابات تأتي في إصدار لاحق.')}</p>
        </HomeBlock>
      </div>

      {/* 4 Monthly income + 5 Monthly spending */}
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <HomeBlock id="monthly-income" title={t('Monthly income', 'الدخل الشهري')} meta={t('Planning estimate', 'تقدير تخطيطي')}>
          {estimate.byCurrency.length ? <EstimateList items={estimate.byCurrency} t={t} testId="text-monthly-income" />
            : <p className="type-label">{estimate.activeCount ? t('No recurring income to estimate', 'لا دخل متكرر للتقدير') : t('No active income saved', 'لا يوجد دخل نشط محفوظ')}</p>}
          {estimate.excluded > 0 && <p className="type-caption pt-2 text-muted-foreground">{t(`${estimate.excluded} one-time or irregular source${estimate.excluded === 1 ? '' : 's'} not included.`, `مصادر لمرة واحدة أو غير منتظمة غير مشمولة: ${estimate.excluded}`)}</p>}
          {!estimate.activeCount && <Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-add-income">{t('Add income sources', 'أضف مصادر دخل')}</Link>}
        </HomeBlock>
        <HomeBlock id="monthly-spending" title={t('Monthly spending', 'الإنفاق الشهري')}>
          <Unavailable testId="status-monthly-spending" label={t('Not tracked yet', 'لا يُتتبع بعد')} body={t('Spending appears once transactions are recorded. Profile costs are plans, not spending.', 'يظهر الإنفاق بعد تسجيل الحركات. تكاليف الملف خطط وليست إنفاقاً.')} />
        </HomeBlock>
      </div>

      {/* 6 Upcoming */}
      <HomeBlock id="upcoming" title={t('Upcoming payments', 'المدفوعات القادمة')}>
        <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
          <Unavailable testId="status-upcoming-payments" label={t('No bills scheduled', 'لا فواتير مجدولة')} body={t('Bills and university payments are not available yet.', 'الفواتير ومدفوعات الجامعة غير متاحة بعد.')} />
          <div><p className="type-caption pb-1 text-muted-foreground">{t('Expected income (from profile)', 'الدخل المتوقع (من الملف)')}</p><UpcomingIncomeList items={upcoming} t={t} /></div>
        </div>
      </HomeBlock>

      {/* Profile-specific planning */}
      {e ? isSchool
        ? <SchoolPlanning profile={profile} incomes={incomes} today={today} t={t} />
        : <UniversityPlanning profile={profile} upcoming={upcoming} t={t} />
        : null}

      {/* 7 Savings, 8 Campus */}
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <HomeBlock id="savings" title={t('Savings goals', 'أهداف الادخار')}>
          <Unavailable testId="status-savings" label={t('No goals yet', 'لا أهداف بعد')} body={t('Savings goals are coming in a later release.', 'أهداف الادخار قادمة في إصدار لاحق.')} />
        </HomeBlock>
        <HomeBlock id="campus" title={t('Campus activity', 'نشاط الحرم')}>
          <Unavailable testId="status-campus" label={t('No campus purchases recorded', 'لا مشتريات جامعية مسجلة')} body={t('Cafeteria, bookstore, printing and university payments will appear here once recorded.', 'الكافتيريا والمكتبة والطباعة ومدفوعات الجامعة ستظهر هنا بعد تسجيلها.')} />
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
        <Unavailable testId="status-transactions" label={t('No transactions yet', 'لا حركات بعد')} body={t('Your onboarding details are for planning only and are never shown as transactions.', 'بيانات الإعداد للتخطيط فقط ولا تُعرض كحركات أبداً.')} />
      </HomeBlock>
    </div>
  );
}
