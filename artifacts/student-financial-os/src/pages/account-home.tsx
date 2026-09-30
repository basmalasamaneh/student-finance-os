import { Link } from 'wouter';
import { getGetProfileQueryKey, useGetProfile, type Profile } from '@workspace/api-client-react';
import { Page, PageHeader, Section } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useAccount } from '@/features/auth/account';
import { Button } from '@/components/ui/button';
import { StudentDashboard } from '@/components/home/student-dashboard';

type T = (en: string, ar: string) => string;

function HomeSkeleton({ t }: { t: T }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6" data-testid="status-loading">
      <span className="sr-only">{t('Loading your home…', 'جارٍ تحميل الصفحة…')}</span>
      <div className="skeleton-shimmer h-4 w-32 rounded" /><div className="skeleton-shimmer h-9 w-64 max-w-full rounded" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-24 w-full rounded-card" />)}
    </div>
  );
}

function NonStudentHome({ data, name, t }: { data: Profile; name: string; t: T }) {
  return <>
    <PageHeader eyebrow={t('YOUR SPACE', 'مساحتك')} title={t(`Welcome, ${name}`, `مرحباً، ${name}`)} lede={t('More than a wallet. Your financial life, organized.', 'أكثر من محفظة. حياتك المالية منظمة.')} actions={<Link href="/profile" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">{t('Edit profile', 'تعديل الملف')}</Link>} />
    <Section title={t('Your education', 'تعليمك')} description={t('Planning details you can always revisit.', 'بيانات تخطيط يمكنك تعديلها دائماً.')}>
      <p className="text-sm leading-7">{data.education?.school ?? data.education?.university ?? t('No institution added yet.', 'لم تُضف مؤسسة تعليمية بعد.')}{data.education?.campus ? ` · ${data.education.campus}` : ''}{data.education?.city ? ` · ${data.education.city}` : ''}</p>
    </Section>
    <p className="border-t border-divider pt-6 text-xs text-muted-foreground">{t('Family finance features are not available yet. Wallet balances and financial activity are not available yet.', 'ميزات المالية العائلية غير متاحة بعد. الأرصدة والحركات المالية غير متاحة حالياً.')}</p>
  </>;
}

export default function AccountHome() {
  const account = useAccount();
  const { lang } = useI18n();
  const t: T = (en, ar) => (lang === 'ar' ? ar : en);
  const { data, isPending, isError, isRefetching, refetch } = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 10_000 } });
  return (
    <Page>
      {isPending ? <HomeSkeleton t={t} />
        : isError || !data ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-10" data-testid="state-error">
            <p className="type-title">{t('Unable to load your profile.', 'تعذّر تحميل ملفك.')}</p>
            <p className="type-body text-muted-foreground">{t('Nothing is shown until your saved details load, so no figure here is ever a guess.', 'لا يُعرض شيء قبل تحميل بياناتك، كي لا يكون أي رقم تخميناً.')}</p>
            <Button onClick={() => refetch()} disabled={isRefetching} data-testid="button-retry">{isRefetching ? t('Retrying…', 'جارٍ المحاولة…') : t('Retry', 'إعادة المحاولة')}</Button>
          </div>
        ) : account.role === 'student' ? <StudentDashboard profile={data} name={account.name} t={t} />
          : <NonStudentHome data={data} name={account.name} t={t} />}
    </Page>
  );
}
