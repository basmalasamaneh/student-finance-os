import { getListCampusCatalogQueryKey, useListCampusCatalog, type Education } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { inputClass } from '@/components/money/fields';

type Text = (en: string, ar: string) => string;
const MANUAL = '__manual';

/**
 * Prompt 10 cascading university → campus selection from the configured catalog.
 * Selecting sends the paired IDs (server canonicalizes names); "Not listed" unlinks and keeps manual names.
 * An empty or unavailable catalog falls back to manual text inputs so legacy profiles stay valid.
 */
export function useCatalogPicker(education: Education | undefined, setEducation: (e: Education) => void, enabled: boolean) {
  const q = useListCampusCatalog({ query: { queryKey: getListCampusCatalogQueryKey(), enabled, staleTime: 30_000 } });
  const catalog = q.data ?? [];
  const e: Education = education ?? { studentType: 'university' };
  const uni = catalog.find((u) => u.id === e.universityId);
  const linked = !!e.universityId;
  const manualMode = !catalog.length || !linked;

  const pickUniversity = (id: string) => {
    const { universityId: _u, campusId: _c, ...rest } = e;
    void _u; void _c;
    if (id === MANUAL || !id) { setEducation({ ...rest, university: linked ? '' : rest.university ?? '', campus: linked ? '' : rest.campus ?? '' }); return; }
    const u = catalog.find((x) => x.id === id);
    if (u) setEducation({ ...rest, universityId: u.id, university: u.name, campus: '' });
  };
  const pickCampus = (id: string) => {
    const c = uni?.campuses.find((x) => x.id === id);
    if (c && uni) setEducation({ ...e, universityId: uni.id, campusId: c.id, campus: c.name, city: e.city || c.city || uni.city || e.city });
  };
  const text = (key: 'university' | 'campus', v: string) => setEducation({ ...e, [key]: v });
  return { q, catalog, uni, linked, manualMode, pickUniversity, pickCampus, text, e };
}

type Picker = ReturnType<typeof useCatalogPicker>;

export function UniversityPickerField({ p, t, lang }: { p: Picker; t: Text; lang: string }) {
  if (p.q.isPending && p.q.fetchStatus !== 'idle') return <Skeleton className="h-[52px] w-full rounded-[14px]" data-testid="skeleton-university-catalog" />;
  const nm = (x: { name: string; arabicName: string }) => (lang === 'ar' ? x.arabicName : x.name);
  return (
    <div className="flex flex-col gap-2">
      {p.catalog.length ? (
        <select className={inputClass} value={p.linked ? p.e.universityId : MANUAL} onChange={(ev) => p.pickUniversity(ev.target.value)} data-testid="select-university" aria-label={t('University', 'الجامعة')}>
          {p.catalog.map((u) => <option key={u.id} value={u.id}>{nm(u)}</option>)}
          <option value={MANUAL}>{t('Not listed — type it', 'غير مدرجة — اكتبها')}</option>
        </select>
      ) : null}
      {p.manualMode ? <input className={inputClass} autoComplete="organization" required value={p.e.university ?? ''} onChange={(ev) => p.text('university', ev.target.value)} placeholder={t('University name', 'اسم الجامعة')} data-testid="input-university-manual" aria-label={t('University name', 'اسم الجامعة')} /> : null}
      {p.q.isError ? <p className="type-caption text-muted-foreground">{t('Catalog unavailable — you can type the name.', 'الكتالوج غير متاح — يمكنك كتابة الاسم.')}</p>
        : !p.catalog.length ? <p className="type-caption text-muted-foreground" data-testid="text-catalog-empty">{t('No universities configured yet — type the name.', 'لا جامعات مُعدّة بعد — اكتب الاسم.')}</p> : null}
    </div>
  );
}

export function CampusPickerField({ p, t, lang }: { p: Picker; t: Text; lang: string }) {
  if (p.q.isPending && p.q.fetchStatus !== 'idle') return <Skeleton className="h-[52px] w-full rounded-[14px]" />;
  const nm = (x: { name: string; arabicName: string }) => (lang === 'ar' ? x.arabicName : x.name);
  if (p.manualMode) return <input className={inputClass} required value={p.e.campus ?? ''} onChange={(ev) => p.text('campus', ev.target.value)} data-testid="input-campus-manual" aria-label={t('Campus', 'الحرم الجامعي')} />;
  if (!p.uni?.campuses.length) return <p className="type-caption text-muted-foreground" data-testid="text-no-campuses">{t('This university has no campuses configured. Choose "Not listed" to type one.', 'لا أحرام مُعدّة لهذه الجامعة. اختر «غير مدرجة» للكتابة.')}</p>;
  return (
    <select className={inputClass} required value={p.e.campusId ?? ''} onChange={(ev) => p.pickCampus(ev.target.value)} data-testid="select-campus" aria-label={t('Campus', 'الحرم الجامعي')}>
      <option value="" disabled>{t('Choose a campus', 'اختر الحرم')}</option>
      {p.uni.campuses.map((c) => <option key={c.id} value={c.id}>{nm(c)}</option>)}
    </select>
  );
}
