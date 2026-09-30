import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check as CheckIcon, ChevronLeft } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  useGetProfile, useSaveProfile, useCompleteProfile,
  getGetProfileQueryKey, getGetMeQueryKey,
  useCreateIncome, useUpdateIncome, useDeleteIncome, useCreateScholarship, useUpdateScholarship, useDeleteScholarship,
  type ProfileInput, type Profile, type IncomeInput, type ScholarshipInput, type Income, type Scholarship,
} from '@workspace/api-client-react';
import { parseMoney, formatMoney, estimateMonthlyCommute, type Currency } from '@workspace/finance-core';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Page, PageHeader, Section } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useAccount } from '@/features/auth/account';
import { cn } from '@/lib/utils';

type Text = (en: string, ar: string) => string;
const study = [['school','School student','طالب مدرسة'],['university','University student','طالب جامعة']] as const;
const residences = [['family','With family','مع العائلة'],['university_housing','University housing','سكن جامعي'],['shared','Shared accommodation','سكن مشترك'],['private','Private accommodation','سكن خاص'],['other','Other','غير ذلك']] as const;
const methods = [['walking','Walking','المشي'],['private_car','Private car','سيارة خاصة'],['family_ride','Family ride','توصيل العائلة'],['taxi','Taxi','تاكسي'],['shared_taxi','Service / shared taxi','سرفيس / تاكسي مشترك'],['bus','Bus','حافلة'],['other','Other','غير ذلك']] as const;
const sources = [['parent_allowance','Parent allowance','مصروف الأهل'],['family_support','Family support','دعم العائلة'],['scholarship','Scholarship','منحة'],['financial_aid','Financial aid','مساعدة مالية'],['student_loan','Student loan','قرض طلابي'],['salary','Salary','راتب'],['part_time','Part-time','دوام جزئي'],['full_time','Full-time','دوام كامل'],['freelance','Freelance','عمل حر'],['internship','Internship','تدريب'],['business_project','Business / project','مشروع'],['gift','Gift','هدية'],['other','Other','غير ذلك']] as const;
const frequencies = [['daily','Daily','يومياً'],['weekly','Weekly','أسبوعياً'],['biweekly','Every two weeks','كل أسبوعين'],['monthly','Monthly','شهرياً'],['quarterly','Quarterly','كل ثلاثة أشهر'],['yearly','Yearly','سنوياً'],['one_time','Once','مرة واحدة'],['irregular','Irregular','غير منتظم']] as const;
const aidTypes = [['scholarship','Scholarship','منحة'],['financial_aid','Financial aid','مساعدة مالية'],['grant','Grant','إعانة'],['other','Other','غير ذلك']] as const;
const steps = [['education','Education','التعليم'],['residence','Residence','السكن'],['commute','Commute','التنقل'],['income','Income','الدخل'],['scholarship','Scholarships & aid','المنح والمساعدات'],['summary','Review','مراجعة']] as const;
type Step = typeof steps[number][0];
function Options({ values, t }: { values: readonly (readonly [string,string,string])[]; t: Text }) {
  return <>{values.map(([v,en,ar]) => <option key={v} value={v}>{t(en,ar)}</option>)}</>;
}
type PageProps = { 'data-q-page'?: number; hidden?: boolean };
function Field({ label, children, hint, q }: { label: string; children: ReactNode; hint?: string; q?: PageProps }) {
  const id=useId();
  return <div {...q} className="min-w-0 space-y-2"><Label id={id} className="block">{label}</Label><div role="group" aria-labelledby={id}>{children}</div>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
const inputClass = 'flex h-[52px] sm:h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
function Select({ value, onChange, options, t }: { value: string; onChange: (v: string) => void; options: readonly (readonly [string,string,string])[]; t: Text }) {
  return <select className={inputClass} value={value} onChange={e => onChange(e.target.value)}><Options values={options} t={t} /></select>;
}
/** Big tappable option cards (radio group). Same value/onChange contract as Select. */
function OptionCards({ value, onChange, options, t, name }: { value: string; onChange: (v: string) => void; options: readonly (readonly [string,string,string])[]; t: Text; name: string }) {
  return <div role="radiogroup" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">{options.map(([v,en,ar]) => {
    const on = v === value;
    return <label key={v} className={cn('group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/60')} data-testid={`option-${name}-${v}`}>
      <input type="radio" name={name} value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
      <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{on ? <CheckIcon className="size-3" aria-hidden /> : null}</span>
      <span className="type-label min-w-0 flex-1">{t(en,ar)}</span>
    </label>;
  })}</div>;
}
function useIsMobile() {
  const q = '(max-width: 639px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const on = () => setM(mq.matches); on(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  return m;
}
/**
 * UI-only question paging for mobile (< 640px). Desktop renders every question (grouped flow).
 * The form keeps its original onSubmit/save handler; `intercept` swallows the submit on
 * intermediate questions (Enter or Next) after validating only that question's controls, so a
 * save can only happen from the last question — where full native validation runs again.
 */
function useQuestionPager(count: number, resetKey: string) {
  const mobile = useIsMobile();
  const [page, setPage] = useState(0);
  const reportingRef = useRef(false);
  useEffect(() => { setPage(0); }, [resetKey]);
  const cur = Math.min(page, Math.max(0, count - 1));
  const paging = mobile && count > 1;
  const isLast = !paging || cur >= count - 1;
  const q = (i: number): PageProps => ({ 'data-q-page': i, hidden: paging && i !== cur ? true : undefined });
  const focusPage = (form: HTMLFormElement | null, i: number) => requestAnimationFrame(() => {
    const el = form?.querySelector<HTMLElement>(`[data-q-page="${i}"] input:not([type=hidden]):not(.sr-only), [data-q-page="${i}"] select, [data-q-page="${i}"] input[type=radio]:checked`);
    el?.focus({ preventScroll: false });
  });
  const intercept = (e: FormEvent<HTMLFormElement>) => {
    if (isLast) return false;
    e.preventDefault();
    const form = e.currentTarget;
    const ctrls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-q-page="${cur}"] input, [data-q-page="${cur}"] select`));
    const bad = ctrls.find((c) => !c.checkValidity());
    if (bad) { bad.reportValidity(); return true; }
    setPage(cur + 1); focusPage(form, cur + 1);
    return true;
  };
  const back = (form: HTMLFormElement | null) => { const n = Math.max(0, cur - 1); setPage(n); focusPage(form, n); };
  /** On the last question, native validation may flag a hidden earlier control: jump to it. */
  const onInvalid = useCallback((e: FormEvent<HTMLFormElement>) => {
    if (!paging) return;
    const el = e.target as HTMLElement;
    const host = el.closest<HTMLElement>('[data-q-page]');
    const i = host ? Number(host.dataset.qPage) : NaN;
    if (Number.isNaN(i) || i === cur) return;
    // Hidden control: stop the native bubble (avoids "invalid form control is not focusable"),
    // reveal its question, move focus, then report once it is visible.
    e.preventDefault();
    if (reportingRef.current) return; // only the first invalid control per submit
    reportingRef.current = true;
    setPage(i);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      reportingRef.current = false;
      const c = el as HTMLInputElement;
      c.focus({ preventScroll: false });
      c.reportValidity?.();
    }));
  }, [paging, cur]);
  return { mobile: paging, page: cur, count, isLast, q, intercept, back, onInvalid, noValidate: paging && !isLast };
}
type Pager = ReturnType<typeof useQuestionPager>;
function PagerControls({ p, t, saving, submitLabel, extra, gradient = true }: { p: Pager; t: Text; saving: boolean; submitLabel: string; extra?: ReactNode; gradient?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} className="space-y-4">
    {p.mobile && <div className="flex items-center gap-3" aria-live="polite"><span className="type-caption tabular text-muted-foreground" data-testid="text-question-progress">{t(`Question ${p.page + 1} of ${p.count}`, `السؤال ${p.page + 1} من ${p.count}`)}</span><span className="flex flex-1 gap-1" aria-hidden>{Array.from({ length: p.count }, (_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= p.page ? 'bg-primary' : 'bg-border')} />)}</span></div>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      {p.mobile && p.page > 0 && <Button type="button" variant="outline" onClick={() => p.back(ref.current?.closest('form') ?? null)} data-testid="button-question-back"><ChevronLeft aria-hidden />{t('Back','رجوع')}</Button>}
      <Button variant={gradient ? 'gradient' : 'default'} className="sm:min-w-44" loading={p.isLast && saving} data-testid={p.isLast ? 'button-save-step' : 'button-question-next'}>{p.isLast ? submitLabel : t('Next','التالي')}</Button>
      {extra}
    </div>
  </div>;
}
function decimalInput(value?: { minor: number; currency: Currency }) {
  if (!value) return '';
  const digits = value.currency === 'JOD' ? 3 : 2;
  const minor = BigInt(value.minor);
  const scale = 10n ** BigInt(digits);
  return `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}`;
}
function AmountField({ label, value, onChange, t, optional = false, q }: { label: string; value?: { minor: number; currency: Currency }; onChange: (v: { minor: number; currency: Currency } | undefined) => void; t: Text; optional?: boolean; q?: PageProps }) {
  const [raw, setRaw] = useState(() => decimalInput(value));
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? t('Enter a valid amount.', 'أدخل مبلغاً صالحاً.') : '');
  }, [invalid, t]);
  const [touched, setTouched] = useState(false);
  const [currency, setCurrency] = useState<Currency>(value?.currency ?? 'ILS');
  useEffect(() => { if (!touched) { setRaw(decimalInput(value)); setCurrency(value?.currency ?? 'ILS'); } }, [value?.minor, value?.currency, touched]);
  return <Field q={q} label={label} hint={t('Enter a decimal amount; stored in exact minor units.', 'أدخل مبلغاً عشرياً؛ يُحفظ بأجزاء العملة الدقيقة.')}>
    <div className="flex min-w-0 gap-2"><Input ref={inputRef} type="text" inputMode="decimal" dir="ltr" aria-label={label} aria-invalid={invalid} required={!optional} value={raw} onChange={e => {
      const next = e.target.value; setTouched(true); setRaw(next);
      if (!next && optional) { setInvalid(false); onChange(undefined); return; }
      try { const m = parseMoney(next, currency); if (m.minor < 0) throw new RangeError(); setInvalid(false); onChange(m); }
      catch { setInvalid(true); onChange(undefined); }
    }} pattern={optional ? '[0-9]+(\\.[0-9]+)?|^$' : '[0-9]+(\\.[0-9]+)?'} />
    <select className={cn(inputClass, 'w-24 shrink-0')} aria-label={t('Currency','العملة')} value={currency} onChange={e => {
      const c = e.target.value as Currency;
      setTouched(true); setCurrency(c);
      try { const m=raw ? parseMoney(raw,c) : optional ? undefined : { minor: 0, currency: c }; setInvalid(false); onChange(m); }
      catch { setInvalid(true); onChange(undefined); }
    }}><option>ILS</option><option>USD</option><option>JOD</option></select></div>
    {invalid && <p role="alert" className="text-xs text-destructive">{t('Invalid amount or unsupported currency precision.','المبلغ غير صالح أو يحتوي على أجزاء أكثر مما تسمح به العملة.')}</p>}
  </Field>;
}
function StepTitle({ title, lede }: { t: Text; title: string; lede: string }) {
  return <div className="space-y-1"><h2 className="type-h2">{title}</h2><p className="type-body text-muted-foreground">{lede}</p></div>;
}
function Row({ children }: { children: ReactNode }) { return <div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>; }
function Check({ label, checked, onChange, q }: { label: string; checked: boolean; onChange: (v:boolean)=>void; q?: PageProps }) {
  return <label {...q} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="size-4 accent-primary" />{label}</label>;
}
function InlineError({ children }: { children: ReactNode }) { return <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{children}</p>; }
function currencyDisplay(m: { minor: number; currency: Currency } | undefined, locale: string) { return m ? formatMoney(m, locale) : '—'; }
function commuteEstimate(commute: ProfileInput['commute']) {
  if (!commute) return undefined;
  try { return estimateMonthlyCommute(commute.tripsPerWeek, commute.costPerTrip, commute.roundTrip); }
  catch { return undefined; }
}

export default function OnboardingPage({ editing = false }: { editing?: boolean }) {
  const { lang, locale } = useI18n();
  const t: Text = (en,ar) => lang === 'ar' ? ar : en;
  const account = useAccount();
  const [,navigate] = useLocation();
  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 10_000 } });
  const [step,setStep] = useState<Step>('education');
  const [draft,setDraft] = useState<ProfileInput>({});
  const [message,setMessage] = useState('');
  const [localError,setLocalError] = useState('');
  useEffect(() => { if (data) setDraft({ name: data.name, education: data.education ?? { studentType: 'university' }, residence: data.residence ?? {type:'family',city:''}, commute: data.commute ?? {homeCity:'',university:'',campus:'',method:'walking',tripsPerWeek:0,costPerTrip:{minor:0,currency:'ILS'},roundTrip:false,monthlyEstimate:{minor:0,currency:'ILS'}} }); }, [data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['/api/profile'] }); qc.invalidateQueries(); };
  const save = useSaveProfile({ mutation: { onSuccess: refresh } });
  const complete = useCompleteProfile({ mutation: { onSuccess: (profile) => {
    // Publish the confirmed identity state before navigating so SessionGate
    // cannot redirect a just-completed account back into onboarding.
    qc.setQueryData(getGetProfileQueryKey(), profile);
    qc.setQueryData(getGetMeQueryKey(), {
      id: account.id, name: profile.name, email: profile.email,
      role: profile.role, onboardingCompleted: profile.onboardingCompleted,
    });
    navigate('/', { replace:true });
  } } });
  const field = (section: 'education'|'residence'|'commute', key: string, value: unknown) => {
    setDraft(old => ({...old, [section]: { ...(old[section] ?? {}), [key]: value } } as ProfileInput));
  };
  const education = draft.education;
  const residence = draft.residence;
  const commute = draft.commute;
  const isUni = (education?.studentType ?? 'university') !== 'school';
  const cOff = education?.studentType === 'university' ? 4 : 2;
  const qCount = step === 'education' ? (isUni ? 9 : 7) : step === 'residence' ? ((residence?.type ?? 'family') === 'family' ? 2 : 7) : step === 'commute' ? cOff + 3 : 1;
  const pager = useQuestionPager(qCount, step);
  const q = pager.q;
  const stepIdx = steps.findIndex(([id]) => id === step);
  const saveStep = (next?: Step) => {
    setMessage('');
    setLocalError('');
    const c = draft.commute;
    const estimate = step === 'commute' && c && !c.manualEstimate ? commuteEstimate(c) : undefined;
    if (step === 'commute' && !c?.manualEstimate && !estimate) {
      setLocalError(t('Commute estimate exceeds the supported amount. Reduce trips or cost.', 'تقدير التنقل يتجاوز المبلغ المدعوم. خفّض عدد الرحلات أو التكلفة.'));
      return;
    }
    const commuteToSave = step === 'commute' && c && estimate ? { ...c, monthlyEstimate: estimate } : c;
    const body: ProfileInput = step === 'education' ? { name: draft.name, education: draft.education } :
      step === 'residence' ? { residence: draft.residence } : step === 'commute' ? { commute: commuteToSave } : { name: draft.name };
    save.mutate({ data: body }, { onSuccess: () => { setMessage(t('Saved to your profile.','تم حفظ البيانات في ملفك.')); if (next) setStep(next); } });
  };
  if (isPending) return <Page className="max-w-6xl"><div role="status" aria-label={t('Loading your saved profile…', 'جارٍ تحميل ملفك المحفوظ…')} className="max-w-3xl space-y-6"><span className="sr-only">{t('Loading your saved profile…', 'جارٍ تحميل ملفك المحفوظ…')}</span><div className="skeleton-shimmer h-8 w-56 rounded-lg" /><div className="skeleton-shimmer h-1.5 w-full rounded-full" /><div className="grid gap-4 sm:grid-cols-2">{[0,1,2,3].map(i=><div key={i} className="skeleton-shimmer h-[52px] rounded-xl sm:h-11" />)}</div></div></Page>;
  if (error || !data) return <Page><div className="max-w-md space-y-4"><InlineError>{t('Could not load your profile.','تعذّر تحميل ملفك.')}</InlineError><Button variant="gradient" onClick={()=>refetch()} data-testid="button-retry-profile">{t('Retry','إعادة المحاولة')}</Button></div></Page>;
  return <Page className="max-w-6xl">
    <PageHeader eyebrow={t('YOUR DETAILS','بياناتك')} title={editing ? t('Your profile','ملفك الشخصي') : t('Make it yours','أكمل ملفك')} lede={t('Your details help you plan. They do not create a balance, transaction, or income posting. You can change them later.','تساعدك بياناتك على التخطيط، ولا تنشئ رصيداً أو حركة مالية أو دخلاً فعلياً. يمكنك تعديلها لاحقاً.')} />
    {account.role === 'parent' || account.role === 'admin' ? <Section title={t('Account details','بيانات الحساب')}><form className="max-w-md space-y-4" onSubmit={e=>{e.preventDefault();save.mutate({data:{name:draft.name}})}}><Field label={t('Full name','الاسم الكامل')}><Input required maxLength={120} value={draft.name ?? ''} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label={t('Email (contact support to change)','البريد الإلكتروني (تواصل مع الدعم لتغييره)')}><Input value={data.email} disabled dir="ltr"/></Field><Button loading={save.isPending}>{t('Save name','حفظ الاسم')}</Button></form><p className="mt-4 text-sm text-muted-foreground">{t('Family connections and administrator tools are coming soon.','العلاقات العائلية وأدوات الإدارة قريباً.')}</p>{!data.onboardingCompleted && <Button className="mt-4" disabled={complete.isPending} onClick={()=>complete.mutate()}>{t('Finish setup','إنهاء الإعداد')}</Button>}</Section> :
    <>
      <div className="mb-8 space-y-3" data-testid="onboarding-progress">
        <div className="flex items-baseline justify-between gap-3"><span className="eyebrow">{t(`Step ${stepIdx+1} of ${steps.length}`, `الخطوة ${stepIdx+1} من ${steps.length}`)}</span><span className="type-caption text-muted-foreground">{t(steps[stepIdx][1], steps[stepIdx][2])}</span></div>
        <div className="track-gold h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIdx+1} aria-label={t('Setup progress','تقدم الإعداد')}><div className="fill-gold h-full rounded-full transition-transform duration-300 ltr:origin-left rtl:origin-right" style={{ transform: `scaleX(${(stepIdx+1)/steps.length})` }} /></div>
        <nav aria-label={t('Onboarding sections','أقسام الإعداد')} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{steps.map(([id,en,ar],idx)=><button type="button" key={id} aria-current={step===id?'step':undefined} onClick={()=>{setStep(id);setMessage('')}} className={cn('inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors', step===id?'border-primary bg-primary-soft text-gold-ink':idx<stepIdx?'border-divider text-foreground':'border-divider text-muted-foreground hover:border-primary')} data-testid={`button-step-${id}`}><span className={cn('grid size-5 place-items-center rounded-full text-[10px] tabular', idx<stepIdx?'bg-primary text-primary-foreground':step===id?'bg-primary/20':'bg-muted')}>{idx<stepIdx?<CheckIcon className="size-3" aria-hidden/>:idx+1}</span>{t(en,ar)}</button>)}</nav>
      </div>
      <div className="max-w-3xl min-w-0">
        {step === 'education' && <form onSubmit={e=>{if(pager.intercept(e))return;e.preventDefault();saveStep('residence')}} onInvalidCapture={pager.onInvalid} noValidate={pager.noValidate} className="space-y-6" data-testid="form-education">
          <StepTitle t={t} title={t('Education','التعليم')} lede={t('Where you study shapes the plan we build with you.','مكان دراستك يحدد شكل الخطة التي نبنيها معك.')} />
          <Row><Field q={q(0)} label={t('Full name','الاسم الكامل')}><Input required maxLength={120} value={draft.name ?? ''} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field q={q(1)} label={t('Student type','نوع الدراسة')}><OptionCards name="student-type" t={t} value={education?.studentType ?? 'university'} options={study} onChange={v=>setDraft(old=>({...old, education: { studentType:v as 'school'|'university' }}))}/></Field></Row>
          {(education?.studentType ?? 'university') === 'school' ? <>
            <Row><Field q={q(2)} label={t('School','المدرسة')}><Input required value={education?.school ?? ''} onChange={e=>field('education','school',e.target.value)}/></Field><Field q={q(3)} label={t('City / area','المدينة / المنطقة')}><Input required value={education?.city ?? ''} onChange={e=>field('education','city',e.target.value)}/></Field></Row>
            <Row><Field q={q(4)} label={t('Grade / level','الصف / المرحلة')}><Input required value={education?.grade ?? ''} onChange={e=>field('education','grade',e.target.value)}/></Field><Field q={q(5)} label={t('Allowance frequency','تكرار المصروف')}><Select t={t} options={frequencies.filter(([v])=>!['biweekly','one_time'].includes(v))} value={education?.allowanceFrequency ?? 'monthly'} onChange={v=>field('education','allowanceFrequency',v)}/></Field></Row>
            <AmountField q={q(6)} t={t} label={t('Typical allowance','المصروف المعتاد')} value={education?.typicalAllowance} onChange={v=>field('education','typicalAllowance',v)}/>
          </> : <>
            <Row><Field q={q(2)} label={t('University','الجامعة')}><Input required value={education?.university ?? ''} onChange={e=>field('education','university',e.target.value)}/></Field><Field q={q(3)} label={t('Campus','الحرم الجامعي')}><Input required value={education?.campus ?? ''} onChange={e=>field('education','campus',e.target.value)}/></Field></Row>
            <Row><Field q={q(4)} label={t('City','المدينة')}><Input required value={education?.city ?? ''} onChange={e=>field('education','city',e.target.value)}/></Field><Field q={q(5)} label={t('Faculty','الكلية')}><Input required value={education?.faculty ?? ''} onChange={e=>field('education','faculty',e.target.value)}/></Field></Row>
            <Row><Field q={q(6)} label={t('Major','التخصص')}><Input required value={education?.major ?? ''} onChange={e=>field('education','major',e.target.value)}/></Field><Field q={q(7)} label={t('Academic year / level','السنة / المرحلة الأكاديمية')}><Input required value={education?.academicYear ?? ''} onChange={e=>field('education','academicYear',e.target.value)}/></Field></Row>
            <Field q={q(8)} label={t('Study status','حالة الدراسة')}><Input required value={education?.studyStatus ?? ''} onChange={e=>field('education','studyStatus',e.target.value)}/></Field>
          </>}
          <PagerControls p={pager} t={t} saving={save.isPending} submitLabel={t('Save and continue','حفظ ومتابعة')} />
        </form>}
        {step === 'residence' && <form className="space-y-6" onSubmit={e=>{if(pager.intercept(e))return;e.preventDefault();saveStep('commute')}} onInvalidCapture={pager.onInvalid} noValidate={pager.noValidate} data-testid="form-residence">
          <StepTitle t={t} title={t('Residence','السكن')} lede={t('Only the city — never your address.','المدينة فقط — لا نحتاج عنوانك.')} />
          <Row><Field q={q(0)} label={t('Living arrangement','نوع السكن')}><OptionCards name="residence" t={t} options={residences} value={residence?.type ?? 'family'} onChange={v=>setDraft(old=>({...old,residence:v==='family'?{type:'family',city:old.residence?.city??''}:{...old.residence,type:v as NonNullable<ProfileInput['residence']>['type'],city:old.residence?.city??''}}))}/></Field><Field q={q(1)} label={t('City / area (no address needed)','المدينة / المنطقة (لا حاجة لعنوان مفصل)')}><Input required value={residence?.city ?? ''} onChange={e=>field('residence','city',e.target.value)}/></Field></Row>
          {residence?.type !== 'family' && <div className="space-y-5"><Row><AmountField q={q(2)} t={t} label={t('Monthly rent','الإيجار الشهري')} value={residence?.monthlyRent} onChange={v=>field('residence','monthlyRent',v)} optional={residence?.type==='other'}/><AmountField q={q(3)} t={t} label={t('Your share','حصتك من الإيجار')} value={residence?.studentShare} onChange={v=>field('residence','studentShare',v)} optional/></Row><Row><AmountField q={q(4)} t={t} label={t('Utilities','الخدمات')} value={residence?.utilities} onChange={v=>field('residence','utilities',v)} optional/><AmountField q={q(5)} t={t} label={t('Internet','الإنترنت')} value={residence?.internet} onChange={v=>field('residence','internet',v)} optional/></Row><AmountField q={q(6)} t={t} label={t('Deposit (optional)','التأمين (اختياري)')} value={residence?.deposit} onChange={v=>field('residence','deposit',v)} optional/></div>}
          <PagerControls p={pager} t={t} saving={save.isPending} submitLabel={t('Save and continue','حفظ ومتابعة')} />
        </form>}
        {step === 'commute' && <form className="space-y-6" onSubmit={e=>{if(pager.intercept(e))return;e.preventDefault();saveStep('income')}} onInvalidCapture={pager.onInvalid} noValidate={pager.noValidate} data-testid="form-commute">
          <StepTitle t={t} title={t('Commute','التنقل')} lede={t('A rough weekly picture is enough.','صورة أسبوعية تقريبية تكفي.')} />
          <Row><Field q={q(0)} label={t('Home city / area','مدينة / منطقة السكن')}><Input required value={commute?.homeCity ?? ''} onChange={e=>field('commute','homeCity',e.target.value)}/></Field><Field q={q(1)} label={t('Transportation method','وسيلة النقل')}><OptionCards name="method" t={t} options={methods} value={commute?.method ?? 'walking'} onChange={v=>field('commute','method',v)}/></Field></Row>
          {education?.studentType==='university' && <Row><Field q={q(2)} label={t('University','الجامعة')}><Input required value={commute?.university ?? ''} onChange={e=>field('commute','university',e.target.value)}/></Field><Field q={q(3)} label={t('Campus','الحرم الجامعي')}><Input required value={commute?.campus ?? ''} onChange={e=>field('commute','campus',e.target.value)}/></Field></Row>}
          <Row><Field q={q(cOff)} label={t('Trips per week','الرحلات أسبوعياً')}><Input type="number" min={0} max={100} required value={commute?.tripsPerWeek ?? 0} onChange={e=>field('commute','tripsPerWeek',Number(e.target.value))}/></Field><AmountField q={q(cOff+1)} t={t} label={t('Average cost per trip','متوسط تكلفة الرحلة')} value={commute?.costPerTrip} onChange={v=>field('commute','costPerTrip',v)}/></Row>
          <div {...q(cOff+2)} className="space-y-4">
          <Check label={t('Cost per trip is one-way; count return trip too','تكلفة الرحلة للذهاب؛ احسب رحلة العودة أيضاً')} checked={commute?.roundTrip ?? false} onChange={v=>field('commute','roundTrip',v)}/>
          <Check label={t('Set monthly estimate manually','تعديل التقدير الشهري يدوياً')} checked={commute?.manualEstimate ?? false} onChange={v=>field('commute','manualEstimate',v)}/>
          {commute?.manualEstimate ? <AmountField t={t} label={t('Manual monthly estimate','التقدير الشهري اليدوي')} value={commute?.monthlyEstimate} onChange={v=>field('commute','monthlyEstimate',v)}/> :
          <p className="rounded-xl bg-surface-sunken p-4 text-sm">{t('Estimated per month','التقدير الشهري')}: <strong dir="ltr">{currencyDisplay(commuteEstimate(commute),locale)}</strong><span className="ms-2 text-muted-foreground">{t('(52 weeks ÷ 12 months, nearest minor unit)','(٥٢ أسبوعاً ÷ ١٢ شهراً، تقريب لأقرب جزء من العملة)')}</span></p>}
          </div>
          <PagerControls p={pager} t={t} saving={save.isPending} submitLabel={t('Save and continue','حفظ ومتابعة')} />
        </form>}
        {step === 'income' && <IncomeSection t={t} locale={locale} profile={data} onRefresh={refresh} onNext={()=>setStep('scholarship')}/>}
        {step === 'scholarship' && <ScholarshipSection t={t} locale={locale} profile={data} onRefresh={refresh} onNext={()=>setStep('summary')}/>}
        {step === 'summary' && <div className="space-y-7">
          <h2 className="type-title">{t('Review before finishing','راجع بياناتك قبل الإنهاء')}</h2>
          {steps.slice(0,-1).map(([id,en,ar]) => <section key={id} className="min-w-0 border-t border-divider pt-4"><div className="flex items-center justify-between gap-4"><h3 className="font-semibold">{t(en,ar)}</h3><Button variant="ghost" onClick={()=>setStep(id)}>{t('Edit','تعديل')}</Button></div><div className="mt-2 break-words text-sm leading-7 text-muted-foreground">
            {id==='education' ? [study.find(s=>s[0]===data.education?.studentType)?.[lang==='ar'?2:1],data.education?.school ?? data.education?.university,data.education?.campus,data.education?.city,data.education?.faculty,data.education?.major,data.education?.grade,data.education?.academicYear,data.education?.studyStatus,data.education?.allowanceFrequency&&frequencies.find(f=>f[0]===data.education?.allowanceFrequency)?.[lang==='ar'?2:1],data.education?.typicalAllowance&&`${t('Typical allowance','المصروف المعتاد')}: ${currencyDisplay(data.education.typicalAllowance,locale)}`].filter(Boolean).join(' · ') || '—' :
            id==='residence' ? [residences.find(r=>r[0]===data.residence?.type)?.[lang==='ar'?2:1],data.residence?.city,currencyDisplay(data.residence?.monthlyRent,locale),currencyDisplay(data.residence?.studentShare,locale),currencyDisplay(data.residence?.utilities,locale),currencyDisplay(data.residence?.internet,locale),currencyDisplay(data.residence?.deposit,locale)].filter(x=>x&&x!=='—').join(' · ') || '—' :
            id==='commute' ? [data.commute?.homeCity,data.commute?.university,data.commute?.campus,methods.find(m=>m[0]===data.commute?.method)?.[lang==='ar'?2:1],data.commute&&`${t('Trips/week','رحلات/الأسبوع')}: ${data.commute.tripsPerWeek}`,data.commute&&`${t('Cost/trip','التكلفة/الرحلة')}: ${currencyDisplay(data.commute.costPerTrip,locale)}`,data.commute&&`${t('Round trip','ذهاب وإياب')}: ${data.commute.roundTrip?t('Yes','نعم'):t('No','لا')}`,data.commute&&`${t('Monthly estimate','التقدير الشهري')}: ${currencyDisplay(data.commute.monthlyEstimate,locale)}`,data.commute&&`${t('Manual estimate','تقدير يدوي')}: ${data.commute.manualEstimate?t('Yes','نعم'):t('No','لا')}`].filter(Boolean).join(' · ') :
            id==='income' ? data.incomes.map(i=>`${sources.find(s=>s[0]===i.source)?.[lang==='ar'?2:1]} ${currencyDisplay(i.amount,locale)}`).join(' · ') || t('No sources yet','لا توجد مصادر بعد') :
            data.scholarships.map(s=>`${s.name} ${currencyDisplay(s.amount,locale)}${s.percentage!==undefined?' · '+s.percentage+'%':''}`).join(' · ') || t('No scholarships yet','لا توجد منح بعد')}
          </div></section>)}
          {!data.onboardingCompleted && <Button variant="gradient" loading={complete.isPending} onClick={()=>complete.mutate()} data-testid="button-finish-setup">{t('Finish setup','إنهاء الإعداد')}</Button>}
          {data.onboardingCompleted && <Link href="/" className="inline-flex h-[52px] items-center rounded-[14px] bg-primary px-5 font-semibold text-primary-foreground sm:h-11" data-testid="link-back-home">{t('Back home','العودة للرئيسية')}</Link>}
          {complete.isError && <InlineError>{t('Complete the required education, residence, and commute details first.','أكمل بيانات التعليم والسكن والتنقل المطلوبة أولاً.')}</InlineError>}
        </div>}
        {save.isError && <InlineError>{t('Could not save. Check all required fields, amounts, and currencies.','تعذّر الحفظ. تحقق من الحقول المطلوبة والمبالغ والعملات.')}</InlineError>}
        {localError && <InlineError>{localError}</InlineError>}
        {message && <p role="status" className="mt-4 text-sm text-success">{message}</p>}
      </div>
    </>}
  </Page>;
}

type IncomeValues = { source: IncomeInput['source']; amount: string; currency: Currency; frequency: IncomeInput['frequency']; expectedDate: string; stability: IncomeInput['stability']; description: string; active: boolean };
function IncomeSection({t,locale,profile,onRefresh,onNext}:{t:Text;locale:string;profile:Profile;onRefresh:()=>void;onNext:()=>void}) {
  const form=useForm<IncomeValues>({defaultValues:{source:'parent_allowance',amount:'',currency:'ILS',frequency:'monthly',expectedDate:'',stability:'stable',description:'',active:true}});
  const [editing,setEditing]=useState<string|null>(null);
  const [error,setError]=useState('');
  const create=useCreateIncome({mutation:{onSuccess:()=>{onRefresh();form.reset();setEditing(null)}}});
  const update=useUpdateIncome({mutation:{onSuccess:()=>{onRefresh();form.reset();setEditing(null)}}});
  const remove=useDeleteIncome({mutation:{onSuccess:onRefresh}});
  const pager=useQuestionPager(8,`income-${editing??'new'}-${create.data?.id??''}-${update.data?.id??''}`); const q=pager.q;
  const edit=(item:Income)=>{setEditing(item.id);form.reset({source:item.source,amount:String(item.amount.minor/(item.amount.currency==='JOD'?1000:100)),currency:item.amount.currency,frequency:item.frequency,expectedDate:item.expectedDate??'',stability:item.stability,description:item.description??'',active:item.active});setError('');};
  const submit=(v:IncomeValues)=>{
    try {
      const amount=parseMoney(v.amount,v.currency);
      if(amount.minor<0) throw Error();
      const input:IncomeInput={source:v.source,amount,frequency:v.frequency,stability:v.stability,active:v.active,...(v.expectedDate?{expectedDate:v.expectedDate}:{}),...(v.description?{description:v.description}:{})};
      setError('');
      if(editing) update.mutate({id:editing,data:input}); else create.mutate({data:input});
    } catch {setError(t('Enter a valid non-negative amount with correct currency precision.','أدخل مبلغاً غير سالب بدقة مناسبة للعملة.'));}
  };
  return <div className="space-y-7"><h2 className="type-title">{t('Income sources','مصادر الدخل')}</h2><p className="text-sm text-muted-foreground">{t('Planning information only; no income is posted to a wallet.','معلومات للتخطيط فقط، لا يضاف دخل إلى أي محفظة.')}</p>
    <div className="space-y-3">{profile.incomes.map(item=><div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-divider py-3"><div className="min-w-0"><p className="font-semibold">{sources.find(s=>s[0]===item.source)?.[t('en','ar')==='ar'?2:1]}</p><p className="break-words text-sm text-muted-foreground">{currencyDisplay(item.amount,locale)} · {frequencies.find(f=>f[0]===item.frequency)?.[t('en','ar')==='ar'?2:1]} · {item.active?t('Active','نشط'):t('Inactive','غير نشط')}{item.expectedDate?' · '+item.expectedDate:''}{item.description?' · '+item.description:''} · {item.stability==='stable'?t('Stable','ثابت'):t('Variable','متغير')}</p></div><div className="flex gap-1"><Button variant="ghost" onClick={()=>edit(item)}>{t('Edit','تعديل')}</Button><Button variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={()=>{if(window.confirm(t('Delete this source?','حذف مصدر الدخل؟')))remove.mutate({id:item.id});}}>{t('Delete','حذف')}</Button></div></div>)}</div>
    <Form {...form}><form onSubmit={e=>{if(pager.intercept(e))return;void form.handleSubmit(submit)(e);}} onInvalidCapture={pager.onInvalid} noValidate={pager.noValidate} data-testid="form-income" className="space-y-5 rounded-card border border-divider bg-surface p-4 sm:p-6"><h3 className="font-semibold">{editing?t('Edit income source','تعديل مصدر الدخل'):t('Add income source','إضافة مصدر دخل')}</h3>
      <Row><Field q={q(0)} label={t('Source','المصدر')}><select className={inputClass} {...form.register('source')}><Options values={sources} t={t}/></select></Field><Field q={q(1)} label={t('Frequency','التكرار')}><select className={inputClass} {...form.register('frequency')}><Options values={frequencies} t={t}/></select></Field></Row>
      <Row><Field q={q(2)} label={t('Amount','المبلغ')}><Input required dir="ltr" inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" {...form.register('amount')}/></Field><Field q={q(3)} label={t('Currency','العملة')}><select className={inputClass} {...form.register('currency')}><option>ILS</option><option>USD</option><option>JOD</option></select></Field></Row>
      <Row><Field q={q(4)} label={t('Expected date (optional)','التاريخ المتوقع (اختياري)')}><Input type="date" {...form.register('expectedDate')}/></Field><Field q={q(5)} label={t('Predictability','طبيعة الدخل')}><select className={inputClass} {...form.register('stability')}><option value="stable">{t('Stable','ثابت')}</option><option value="variable">{t('Variable','متغير')}</option></select></Field></Row>
      <Field q={q(6)} label={t('Description (optional)','الوصف (اختياري)')}><Input maxLength={500} {...form.register('description')}/></Field><Check q={q(7)} label={t('Currently active','نشط حالياً')} checked={form.watch('active')} onChange={v=>form.setValue('active',v)}/>
      {(error||create.isError||update.isError||remove.isError) && <InlineError>{error||t('Could not save this source. Please try again.','تعذّر حفظ مصدر الدخل. حاول مجدداً.')}</InlineError>}
      <PagerControls p={pager} t={t} gradient={false} saving={create.isPending||update.isPending} submitLabel={editing?t('Save changes','حفظ التغييرات'):t('Add source','إضافة المصدر')} extra={editing&&<Button type="button" variant="secondary" onClick={()=>{setEditing(null);form.reset();}}>{t('Cancel','إلغاء')}</Button>} />
    </form></Form>
    <Button variant="outline" onClick={onNext}>{t('Continue to scholarships','تابع إلى المنح')}</Button>
  </div>;
}
type AidValues = { name:string;provider:string;type:ScholarshipInput['type'];amount:string;currency:Currency;percentage:string;tuitionCoverage:string;paymentSchedule:string;startDate:string;endDate:string;renewalDate:string;remainingCoverage:string;notes:string };
function ScholarshipSection({t,locale,profile,onRefresh,onNext}:{t:Text;locale:string;profile:Profile;onRefresh:()=>void;onNext:()=>void}) {
  const form=useForm<AidValues>({defaultValues:{name:'',provider:'',type:'scholarship',amount:'',currency:'ILS',percentage:'',tuitionCoverage:'',paymentSchedule:'',startDate:'',endDate:'',renewalDate:'',remainingCoverage:'',notes:''}});
  const [editing,setEditing]=useState<string|null>(null);
  const [error,setError]=useState('');
  const create=useCreateScholarship({mutation:{onSuccess:()=>{onRefresh();form.reset();setEditing(null)}}});
  const update=useUpdateScholarship({mutation:{onSuccess:()=>{onRefresh();form.reset();setEditing(null)}}});
  const remove=useDeleteScholarship({mutation:{onSuccess:onRefresh}});
  const pager=useQuestionPager(13,`aid-${editing??'new'}-${create.data?.id??''}-${update.data?.id??''}`); const q=pager.q;
  const decimal=(m:Scholarship['amount'])=>m?String(m.minor/(m.currency==='JOD'?1000:100)):'';
  const edit=(item:Scholarship)=>{setEditing(item.id);form.reset({name:item.name,provider:item.provider,type:item.type,amount:decimal(item.amount),currency:item.amount?.currency??item.remainingCoverage?.currency??'ILS',percentage:item.percentage===undefined?'':String(item.percentage),tuitionCoverage:item.tuitionCoverage??'',paymentSchedule:item.paymentSchedule??'',startDate:item.startDate??'',endDate:item.endDate??'',renewalDate:item.renewalDate??'',remainingCoverage:decimal(item.remainingCoverage),notes:item.notes??''});setError('');};
  const submit=(v:AidValues)=>{
    try {
      if(!v.amount&&!v.percentage) throw Error('amount');
      if(v.startDate&&v.endDate&&v.endDate<v.startDate) throw Error('dates');
      const input:ScholarshipInput={name:v.name.trim(),provider:v.provider.trim(),type:v.type,...(v.amount?{amount:parseMoney(v.amount,v.currency)}:{}),...(v.percentage?{percentage:Number(v.percentage)}:{}),...(v.remainingCoverage?{remainingCoverage:parseMoney(v.remainingCoverage,v.currency)}:{}),...(v.tuitionCoverage?{tuitionCoverage:v.tuitionCoverage}:{}),...(v.paymentSchedule?{paymentSchedule:v.paymentSchedule}:{}),...(v.startDate?{startDate:v.startDate}:{}),...(v.endDate?{endDate:v.endDate}:{}),...(v.renewalDate?{renewalDate:v.renewalDate}:{}),...(v.notes?{notes:v.notes}:{})};
      if(input.amount && input.amount.minor<0 || input.remainingCoverage && input.remainingCoverage.minor<0 || input.percentage!==undefined && (!Number.isInteger(input.percentage)||input.percentage<0||input.percentage>100)) throw Error();
      setError('');
      if(editing) update.mutate({id:editing,data:input});else create.mutate({data:input});
    } catch {setError(t('Enter an amount or a percentage, valid dates, and non-negative amounts.','أدخل مبلغاً أو نسبة وتواريخ صحيحة ومبالغ غير سالبة.'));}
  };
  return <div className="space-y-7"><h2 className="type-title">{t('Scholarships & aid','المنح والمساعدات')}</h2>
    <div className="space-y-3">{profile.scholarships.map(item=><div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-divider py-3"><div className="min-w-0"><p className="font-semibold">{item.name} · {item.provider}</p><p className="break-words text-sm text-muted-foreground">{aidTypes.find(a=>a[0]===item.type)?.[t('en','ar')==='ar'?2:1]} · {currencyDisplay(item.amount,locale)} {item.percentage!==undefined?' · '+item.percentage+'%':''}{item.tuitionCoverage?' · '+item.tuitionCoverage:''}{item.paymentSchedule?' · '+item.paymentSchedule:''}{item.startDate?' · '+item.startDate:''}{item.endDate?' · '+item.endDate:''}{item.renewalDate?' · '+item.renewalDate:''}{item.remainingCoverage?' · '+currencyDisplay(item.remainingCoverage,locale):''}{item.notes?' · '+item.notes:''}</p></div><div className="flex gap-1"><Button variant="ghost" onClick={()=>edit(item)}>{t('Edit','تعديل')}</Button><Button variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={()=>{if(window.confirm(t('Delete this scholarship?','حذف هذه المنحة؟')))remove.mutate({id:item.id});}}>{t('Delete','حذف')}</Button></div></div>)}</div>
    <Form {...form}><form className="space-y-5 rounded-card border border-divider bg-surface p-4 sm:p-6" onSubmit={e=>{if(pager.intercept(e))return;void form.handleSubmit(submit)(e);}} onInvalidCapture={pager.onInvalid} noValidate={pager.noValidate} data-testid="form-scholarship"><h3 className="font-semibold">{editing?t('Edit scholarship','تعديل المنحة'):t('Add scholarship or aid','إضافة منحة أو مساعدة')}</h3>
      <Row><Field q={q(0)} label={t('Name','الاسم')}><Input required maxLength={160} {...form.register('name')}/></Field><Field q={q(1)} label={t('Provider','الجهة المانحة')}><Input required maxLength={160} {...form.register('provider')}/></Field></Row>
      <Row><Field q={q(2)} label={t('Type','النوع')}><select className={inputClass} {...form.register('type')}><Options values={aidTypes} t={t}/></select></Field><Field q={q(3)} label={t('Currency','العملة')}><select className={inputClass} {...form.register('currency')}><option>ILS</option><option>USD</option><option>JOD</option></select></Field></Row>
      <Row><Field q={q(4)} label={t('Amount (if applicable)','المبلغ (إن وجد)')}><Input dir="ltr" inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?|^$" {...form.register('amount')}/></Field><Field q={q(5)} label={t('Percentage (if applicable)','النسبة المئوية (إن وجدت)')}><Input type="number" min={0} max={100} step={1} {...form.register('percentage')}/></Field></Row>
      <Row><Field q={q(6)} label={t('Tuition coverage','تغطية الرسوم الدراسية')}><Input maxLength={160} {...form.register('tuitionCoverage')}/></Field><Field q={q(7)} label={t('Payment schedule','جدول الصرف')}><Input maxLength={160} {...form.register('paymentSchedule')}/></Field></Row>
      <Row><Field q={q(8)} label={t('Start date','تاريخ البدء')}><Input type="date" {...form.register('startDate')}/></Field><Field q={q(9)} label={t('End date','تاريخ الانتهاء')}><Input type="date" {...form.register('endDate')}/></Field></Row>
      <Row><Field q={q(10)} label={t('Renewal date','تاريخ التجديد')}><Input type="date" {...form.register('renewalDate')}/></Field><Field q={q(11)} label={t('Remaining coverage','التغطية المتبقية')}><Input dir="ltr" inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?|^$" {...form.register('remainingCoverage')}/></Field></Row>
      <Field q={q(12)} label={t('Notes','ملاحظات')}><Input maxLength={1000} {...form.register('notes')}/></Field>
      {(error||create.isError||update.isError||remove.isError)&&<InlineError>{error||t('Could not save scholarship. Try again.','تعذّر حفظ المنحة. حاول مجدداً.')}</InlineError>}
      <PagerControls p={pager} t={t} gradient={false} saving={create.isPending||update.isPending} submitLabel={editing?t('Save changes','حفظ التغييرات'):t('Add scholarship','إضافة المنحة')} extra={editing&&<Button type="button" variant="secondary" onClick={()=>{setEditing(null);form.reset();}}>{t('Cancel','إلغاء')}</Button>} />
    </form></Form><Button variant="outline" onClick={onNext}>{t('Review summary','مراجعة الملخص')}</Button>
  </div>;
}