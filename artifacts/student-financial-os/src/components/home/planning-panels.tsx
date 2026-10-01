import { UNIVERSITY_CATEGORIES, UpcomingHomeList } from './upcoming-block';
import { Link } from 'wouter';
import { GoalsHomeBlock } from './goals-block';
import type { FinanceSummary, Profile } from '@workspace/api-client-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ActualIncomeSpending } from './finance-blocks';
import { formatDate } from '@workspace/finance-core';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useI18n } from '@/features/i18n/i18n-provider';
import { Fact, HomeBlock, type T } from './home-primitives';
import {
  formatTenths, nextAllowance, weeklyAllowance, type HomeIncome, type Insight, type UpcomingIncome,
} from '@/features/home/student-home-model';

const SOURCE: Record<string, [string, string]> = {
  parent_allowance: ['Parent allowance', 'مصروف من الأهل'], family_support: ['Family support', 'دعم عائلي'],
  scholarship: ['Scholarship', 'منحة'], financial_aid: ['Financial aid', 'مساعدة مالية'], student_loan: ['Student loan', 'قرض طلابي'],
  salary: ['Salary', 'راتب'], part_time: ['Part-time work', 'عمل جزئي'], full_time: ['Full-time work', 'عمل بدوام كامل'],
  freelance: ['Freelance', 'عمل حر'], internship: ['Internship', 'تدريب'], business_project: ['Business project', 'مشروع تجاري'],
  gift: ['Gift', 'هدية'], other: ['Other', 'أخرى'],
};
const RESIDENCE: Record<string, [string, string]> = {
  family: ['With family', 'مع العائلة'], university_housing: ['University housing', 'سكن جامعي'],
  shared: ['Shared housing', 'سكن مشترك'], private: ['Private housing', 'سكن خاص'], other: ['Other', 'أخرى'],
};
const FREQ: Record<string, [string, string]> = {
  daily: ['daily', 'يومي'], weekly: ['weekly', 'أسبوعي'], monthly: ['monthly', 'شهري'], quarterly: ['quarterly', 'ربع سنوي'], yearly: ['yearly', 'سنوي'], irregular: ['irregular', 'غير منتظم'],
};

export const sourceLabel = (t: T, s: string) => { const l = SOURCE[s] ?? SOURCE.other; return t(l[0], l[1]); };

function useDay() {
  const { locale } = useI18n();
  return (day: string) => formatDate(new Date(`${day}T12:00:00Z`), locale, 'UTC');
}

export function UpcomingIncomeList({ items, t }: { items: UpcomingIncome[]; t: T }) {
  const fmt = useDay();
  if (!items.length) return <p className="type-caption text-muted-foreground">{t('No expected income dates saved.', 'لا توجد تواريخ دخل متوقعة محفوظة.')}</p>;
  return (
    <ul className="divide-y divide-divider">
      {items.slice(0, 4).map(({ income, day }) => (
        <li key={income.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5" data-testid={`row-upcoming-income-${income.id}`}>
          <div className="min-w-0">
            <p className="type-label">{sourceLabel(t, income.source)}</p>
            <p className="type-caption text-muted-foreground">{t('Expected', 'متوقع')} {fmt(day)}</p>
          </div>
          <MoneyDisplay value={income.amount} size="sm" tone="planned" />
        </li>
      ))}
    </ul>
  );
}

const ProfileLink = ({ t, label }: { t: T; label?: string }) => (
  <Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-profile-planning">{label ?? t('Add in profile', 'أضف في الملف')}</Link>
);

export function UniversityPlanning({ profile, t, hidden }: { profile: Profile; t: T; hidden?: boolean }) {
  const fmt = useDay();
  const { residence: r, commute: c, education: e } = profile;
  return (
    <HomeBlock id="university-planning" title={t('University planning', 'التخطيط الجامعي')} meta={t('From your saved profile', 'من ملفك المحفوظ')}>
      <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <div data-testid="block-university-payments">
          <p className="type-caption pb-1 text-muted-foreground">{t('Upcoming university payments · next 90 days', 'دفعات الجامعة القادمة · 90 يوماً')}</p>
          <UpcomingHomeList t={t} hidden={hidden} days={90} kind="expense" categories={UNIVERSITY_CATEGORIES} testId="list-university-upcoming"
            emptyText={t('No dated tuition, fee, book or housing payments in your plan. Add one in Upcoming — no due date is assumed.', 'لا توجد دفعات رسوم أو كتب أو سكن مؤرخة في خطتك. أضف واحدة في القادم — لا يُفترض أي موعد.')} />
        </div>
        <div data-testid="block-commute">
          <p className="type-caption text-muted-foreground">{t('Transportation estimate / month', 'تقدير التنقل / شهرياً')}</p>
          {c ? <>
            <MoneyDisplay value={c.monthlyEstimate} size="lg" tone="projected" testId="text-commute-estimate" />
            <p className="type-caption text-muted-foreground">{c.manualEstimate ? t('Your manual estimate', 'تقديرك اليدوي') : t(`${c.tripsPerWeek} trips/week${c.roundTrip ? ', round trip' : ''}`, `${c.tripsPerWeek} رحلات/أسبوع${c.roundTrip ? '، ذهاب وإياب' : ''}`)}{c.campus || e?.campus ? ` · ${c.campus ?? e?.campus}` : ''}</p>
          </> : <><p className="type-label">{t('No commute saved', 'لا توجد بيانات تنقل')}</p><ProfileLink t={t} /></>}
        </div>
        <div data-testid="block-housing">
          <p className="type-caption text-muted-foreground">{t('Housing', 'السكن')}</p>
          {r ? <>
            <p className="type-label">{t(RESIDENCE[r.type][0], RESIDENCE[r.type][1])} · {r.city}</p>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              {r.studentShare && <Fact label={t('Your share', 'حصتك')}><MoneyDisplay value={r.studentShare} size="sm" tone="planned" /></Fact>}
              {r.monthlyRent && <Fact label={t('Monthly rent', 'الإيجار الشهري')}><MoneyDisplay value={r.monthlyRent} size="sm" tone="planned" /></Fact>}
              {r.utilities && <Fact label={t('Utilities', 'الخدمات')}><MoneyDisplay value={r.utilities} size="sm" tone="planned" /></Fact>}
              {r.internet && <Fact label={t('Internet', 'الإنترنت')}><MoneyDisplay value={r.internet} size="sm" tone="planned" /></Fact>}
            </dl>
          </> : <><p className="type-label">{t('No housing saved', 'لا توجد بيانات سكن')}</p><ProfileLink t={t} /></>}
        </div>
        <div className="sm:col-span-2" data-testid="block-scholarships">
          <p className="type-caption pb-1 text-muted-foreground">{t('Scholarships & aid', 'المنح والمساعدات')}</p>
          {profile.scholarships.length ? (
            <ul className="divide-y divide-divider">
              {profile.scholarships.map((s) => (
                <li key={s.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" data-testid={`row-scholarship-${s.id}`}>
                  <div className="min-w-0">
                    <p className="type-label break-words">{s.name}</p>
                    <p className="type-caption break-words text-muted-foreground">{s.provider}{s.percentage != null ? ` · ${s.percentage}%` : ''}{s.tuitionCoverage ? ` · ${s.tuitionCoverage}` : ''}{s.renewalDate ? ` · ${t('Renews', 'تجديد')} ${fmt(s.renewalDate.slice(0, 10))}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    {s.amount && <MoneyDisplay value={s.amount} size="sm" tone="planned" />}
                    {s.remainingCoverage && <span className="type-caption text-muted-foreground">{t('Remaining', 'المتبقي')} <MoneyDisplay value={s.remainingCoverage} size="sm" tone="muted" /></span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <><p className="type-label">{t('No scholarships or aid saved', 'لا توجد منح محفوظة')}</p><ProfileLink t={t} /></>}
        </div>
      </div>
    </HomeBlock>
  );
}

export function SchoolPlanning({ profile, incomes, today, summary, t }: { profile: Profile; incomes: HomeIncome[]; today: string; summary: UseQueryResult<FinanceSummary, unknown>; t: T }) {
  const fmt = useDay();
  const e = profile.education;
  const weekly = weeklyAllowance(e?.typicalAllowance, e?.allowanceFrequency);
  const next = nextAllowance(incomes, today);
  return (
    <HomeBlock id="school-planning" title={t('Allowance planning', 'تخطيط المصروف')} meta={e?.school ?? undefined}>
      <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <div data-testid="block-weekly-allowance">
          <p className="type-caption text-muted-foreground">{t('Weekly allowance', 'المصروف الأسبوعي')}</p>
          {weekly ? weekly.result.ok ? <>
            <MoneyDisplay value={{ minor: weekly.result.minor, currency: weekly.currency }} size="lg" tone="projected" testId="text-weekly-allowance" />
            <p className="type-caption text-muted-foreground">{e?.allowanceFrequency === 'weekly' ? t('As saved in your profile', 'كما في ملفك') : t(`Converted from your ${FREQ[e!.allowanceFrequency!][0]} allowance`, `محسوب من مصروفك الـ${FREQ[e!.allowanceFrequency!][1]}`)}</p>
          </> : <p className="type-label text-destructive">{t('Too large to display exactly', 'أكبر من أن يُعرض بدقة')}</p>
            : e?.allowanceFrequency === 'irregular'
              ? <p className="type-label">{t('Irregular — no weekly figure', 'غير منتظم — لا رقم أسبوعي')}</p>
              : <><p className="type-label">{t('No allowance saved', 'لا يوجد مصروف محفوظ')}</p><ProfileLink t={t} /></>}
        </div>
        <div data-testid="block-next-allowance">
          <p className="type-caption text-muted-foreground">{t('Next allowance', 'المصروف القادم')}</p>
          {next ? <><p className="type-label">{fmt(next.day)}</p><MoneyDisplay value={next.income.amount} size="sm" tone="planned" /></>
            : <><p className="type-label">{t('Date unknown', 'الموعد غير معروف')}</p><p className="type-caption text-muted-foreground">{t('Add an expected date to an active parent allowance to see it here.', 'أضف تاريخاً متوقعاً لمصروف أهل نشط ليظهر هنا.')}</p></>}
        </div>
        <div data-testid="status-school-spending">
          <p className="type-caption pb-1 text-muted-foreground">{t('Spending this month', 'الإنفاق هذا الشهر')}</p>
          <ActualIncomeSpending summary={summary} kind="spending" t={t} />
          <p className="type-caption pt-1 text-muted-foreground">{t('Recorded purchases only, per currency. Nothing is estimated from your allowance.', 'المشتريات المسجلة فقط، لكل عملة. لا نقدّر شيئاً من مصروفك.')}</p>
        </div>
        <div data-testid="status-school-savings"><p className="type-caption pb-1 text-muted-foreground">{t('Savings', 'الادخار')}</p><GoalsHomeBlock t={t} limit={1} /></div>
      </div>
    </HomeBlock>
  );
}

export function InsightText({ insight, t }: { insight: Insight; t: T }) {
  const costName = (c: 'commute' | 'housing') => (c === 'commute' ? t('commute estimate', 'تقدير التنقل') : t('housing share', 'حصة السكن'));
  switch (insight.kind) {
    case 'no-income':
      return <>{t('No active income is saved, so there is no monthly picture to compare against yet. Adding your allowance, work or aid makes every planning figure here meaningful.', 'لا يوجد دخل نشط محفوظ، لذا لا توجد صورة شهرية للمقارنة. إضافة المصروف أو العمل أو المنحة تجعل أرقام التخطيط ذات معنى.')}</>;
    case 'only-unscheduled':
      return <>{t(`Your ${insight.count} active income source${insight.count === 1 ? ' is' : 's are'} one-time or irregular, so no monthly estimate is made. Expected dates still show below.`, `مصادر دخلك النشطة (${insight.count}) لمرة واحدة أو غير منتظمة، لذا لا تقدير شهري. التواريخ المتوقعة تظهر أدناه.`)}</>;
    case 'currency-mismatch':
      return <>{t(`Your ${costName(insight.cost)} is in a currency with no recurring income saved, so no share is calculated. Currencies are never converted or combined.`, `${costName(insight.cost)} بعملة لا يوجد لها دخل متكرر، لذا لا تُحسب نسبة. لا نحوّل العملات ولا نجمعها.`)}</>;
    case 'cost-share':
      return <>{t(`Your ${costName(insight.cost)} equals `, `${costName(insight.cost)} يعادل `)}<bdi dir="ltr" className="tabular font-semibold">{formatTenths(insight.tenths)}%</bdi>{t(` of your estimated recurring ${insight.currency} income per month, based only on the figures you saved.`, ` من دخلك المتكرر المقدّر بعملة ${insight.currency} شهرياً، بناءً على أرقامك المحفوظة فقط.`)}</>;
    case 'allowance-weekly':
      return <>{t('Your saved allowance works out to ', 'مصروفك المحفوظ يعادل ')}<MoneyDisplay value={{ minor: insight.minor, currency: insight.currency }} size="sm" />{t(' a week. Tracking purchases later will show how much of it stays with you.', ' أسبوعياً. تتبّع المشتريات لاحقاً سيُظهر كم يبقى معك.')}</>;
    case 'estimate-ready':
      return <>{t(`Your monthly estimate combines ${insight.sources} recurring source${insight.sources === 1 ? '' : 's'}`, `تقديرك الشهري يجمع ${insight.sources} مصادر متكررة`)}{insight.currencies > 1 ? t(', kept separate per currency', '، مفصولة حسب العملة') : ''}{t('. Add commute or housing costs to see what share they take.', '. أضف تكاليف التنقل أو السكن لترى نسبتها.')}</>;
  }
}
