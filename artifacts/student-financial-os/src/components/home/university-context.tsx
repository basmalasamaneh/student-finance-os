import { Link } from 'wouter';
import { getListCampusCatalogQueryKey, useListCampusCatalog, type Profile } from '@workspace/api-client-react';
import { useI18n } from '@/features/i18n/i18n-provider';
import { HomeBlock, type T } from './home-primitives';
import { SkeletonRows } from '@/components/states/state-panel';

const linkCls = 'type-label inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 transition-colors hover:border-primary';

/** Prompt 10: admin-configured university/campus context + links into existing profile/plan records. No new calculations. */
export function UniversityContext({ profile, t }: { profile: Profile; t: T }) {
  const { lang } = useI18n();
  const e = profile.education;
  const linked = !!(e?.universityId && e.campusId);
  const q = useListCampusCatalog({ query: { queryKey: getListCampusCatalogQueryKey(), enabled: linked, staleTime: 30_000 } });
  const uni = q.data?.find((u) => u.id === e?.universityId);
  const campus = uni?.campuses.find((c) => c.id === e?.campusId);
  const nm = (x: { name: string; arabicName: string }) => (lang === 'ar' ? x.arabicName : x.name);
  const cats = new Set((campus?.services ?? []).filter((s) => s.active).map((s) => s.category));
  const facts: [string, string | undefined][] = [
    [t('City', 'المدينة'), campus?.city || uni?.city || e?.city],
    [t('Faculty', 'الكلية'), e?.faculty], [t('Major', 'التخصص'), e?.major], [t('Academic year', 'السنة الأكاديمية'), e?.academicYear],
  ];
  const meta: [string, string | undefined][] = [
    [t('Tuition', 'الرسوم الدراسية'), uni?.tuitionConfiguration], [t('Scholarships', 'المنح'), uni?.scholarshipConfiguration],
    [t('Housing', 'السكن'), campus?.housingContext || uni?.housingAvailability], [t('Transportation', 'المواصلات'), campus?.transportationContext || uni?.transportationContext],
    [t('Location', 'الموقع'), campus?.locationDescription],
  ];
  const services: [string, string, boolean][] = [
    ['food', t('Cafeteria', 'الكافتيريا'), cats.has('food')], ['books', t('Bookstore', 'المكتبة'), cats.has('books')], ['printing', t('Printing', 'الطباعة'), cats.has('printing')],
  ];
  return (
    <HomeBlock id="university-context" title={t('Your university', 'جامعتك')} meta={linked ? (uni && campus ? `${nm(uni)} · ${nm(campus)}` : undefined) : t('Typed manually', 'مكتوبة يدوياً')}>
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="type-caption text-muted-foreground">{k}</dt><dd className="type-label break-words">{v || '—'}</dd></div>)}
        </dl>
        {linked ? q.isPending ? <SkeletonRows rows={2} label={t('Loading university details…', 'جارٍ تحميل تفاصيل الجامعة…')} />
          : q.isError ? <p className="type-caption text-muted-foreground">{t('University details are unavailable right now.', 'تفاصيل الجامعة غير متاحة الآن.')}</p>
          : <>
            <div className="flex flex-wrap gap-2" data-testid="list-campus-services">
              {services.map(([id, l, on]) => <span key={id} className={on ? 'type-caption rounded-full bg-primary-soft px-3 py-1 text-gold-ink' : 'type-caption rounded-full border border-dashed border-input px-3 py-1 text-muted-foreground'}>{l} · {on ? t('on campus', 'في الحرم') : t('not configured', 'غير مُعد')}</span>)}
            </div>
            <dl className="flex flex-col gap-3">
              {meta.map(([k, v]) => <div key={k}><dt className="type-caption text-muted-foreground">{k}</dt><dd className="type-body whitespace-pre-line">{v || <span className="text-muted-foreground">{t('Not configured by the university', 'غير مُعد من الجامعة')}</span>}</dd></div>)}
            </dl>
            <p className="type-caption text-muted-foreground">{t('Informational text from the administrator — never a charge, price or forecast.', 'نص معلوماتي من المشرف — ليس رسماً أو سعراً أو توقعاً.')}</p>
          </> : <p className="type-caption text-muted-foreground">{t('Link your university from the catalog in your profile to see its details.', 'اربط جامعتك من الكتالوج في ملفك لرؤية تفاصيلها.')}</p>}
        <div className="flex flex-col gap-2">
          <p className="type-caption text-muted-foreground">{t('Plan tuition, registration, fees, housing, transport, cafeteria, books, printing, internet and supplies; track scholarships, aid and loans.', 'خطط للرسوم والتسجيل والسكن والمواصلات والكافتيريا والكتب والطباعة والإنترنت واللوازم؛ وتابع المنح والمساعدات والقروض.')}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/plan" className={linkCls} data-testid="link-university-plan">{t('Plan university costs', 'خطط تكاليف الجامعة')}</Link>
            <Link href="/profile" className={linkCls} data-testid="link-university-aid">{t('Scholarships, aid & loans', 'المنح والمساعدات والقروض')}</Link>
            <Link href="/campus" className={linkCls} data-testid="link-university-campus">{t('Campus payments', 'مدفوعات الحرم')}</Link>
          </div>
        </div>
      </div>
    </HomeBlock>
  );
}
