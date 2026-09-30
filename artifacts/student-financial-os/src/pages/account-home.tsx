import { Link } from 'wouter';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { formatMoney } from '@workspace/finance-core';
import { Page, PageHeader, Section } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useAccount } from '@/features/auth/account';
import { Button } from '@/components/ui/button';

export default function AccountHome() {
  const account = useAccount();
  const { lang, locale } = useI18n();
  const t = (en:string,ar:string)=>lang==='ar'?ar:en;
  const { data, isPending, isError, refetch } = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 30_000 } });
  return <Page><PageHeader eyebrow={t('YOUR SPACE','مساحتك')} title={t(`Welcome, ${account.name}`, `مرحباً، ${account.name}`)} lede={t('More than a wallet. Your financial life, organized.','أكثر من محفظة. حياتك المالية منظمة.')} actions={<Link href="/profile" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">{t('Edit profile','تعديل الملف')}</Link>} />
    {isPending ? <p role="status">{t('Loading your profile…','جارٍ تحميل ملفك…')}</p> : isError || !data ? <div role="alert">{t('Unable to load your profile.','تعذّر تحميل ملفك.')} <Button onClick={()=>refetch()}>{t('Retry','إعادة المحاولة')}</Button></div> : <>
      <Section title={t('Your education','تعليمك')} description={t('Planning details you can always revisit.','بيانات تخطيط يمكنك تعديلها دائماً.')}>
        <p className="text-sm leading-7">{data.education?.school ?? data.education?.university ?? t('No institution added yet.','لم تُضف مؤسسة تعليمية بعد.')}{data.education?.campus ? ` · ${data.education.campus}` : ''}{data.education?.city ? ` · ${data.education.city}` : ''}</p>
      </Section>
      {account.role==='student'&&<><Section title={t('Residence & commute','السكن والتنقل')}><p className="text-sm leading-7">{data.residence?.city || t('No residence details yet.','لا توجد بيانات سكن بعد.')}</p>{data.commute&&<p className="text-sm text-muted-foreground">{t('Estimated monthly commute','التكلفة الشهرية المقدّرة للتنقل')}: <b dir="ltr">{formatMoney(data.commute.monthlyEstimate,locale)}</b>{data.commute.manualEstimate&&t(' (manual estimate)',' (تقدير يدوي)')}</p>}</Section>
      <Section title={t('Income sources','مصادر الدخل')}><p className="text-sm">{data.incomes.length ? t(`${data.incomes.length} sources recorded for planning.`, `مصادر مسجلة للتخطيط: ${data.incomes.length}`) : t('No income sources recorded yet.','لم تُسجل مصادر دخل بعد.')}</p></Section>
      <Section title={t('Scholarships & aid','المنح والمساعدات')}><p className="text-sm">{data.scholarships.length ? t(`${data.scholarships.length} entries recorded.`, `عدد الإدخالات: ${data.scholarships.length}`) : t('No scholarships recorded yet.','لم تُسجل منح بعد.')}</p></Section></>}
      <p className="border-t border-divider pt-6 text-xs text-muted-foreground">{t('Your onboarding details are for planning only. Wallet balances and financial activity are not available yet.','بيانات الإعداد للتخطيط فقط. الأرصدة والحركات المالية غير متاحة حالياً.')}</p>
    </>}
  </Page>;
}