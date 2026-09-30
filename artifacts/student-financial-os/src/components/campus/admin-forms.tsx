import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  useCreateCampus, useCreateCampusProduct, useCreateCampusService, useCreateCampusUniversity, useUpdateCampusProduct, useUpdateCampusService,
  type CampusProduct, type CampusService, type CampusServiceInputCategory, type AmountCurrency,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Notice } from '@/components/states/state-panel';
import { AmountInput, Field, inputClass } from '@/components/money/fields';
import { amountErrorText, apiErrorText, CATEGORY_LABEL, parseAmountInput, useRefreshFinance, type Tx } from '@/features/money/money-model';

export type AdminTarget =
  | { kind: 'university' }
  | { kind: 'campus'; universityId: string }
  | { kind: 'service'; campusId: string; service?: CampusService }
  | { kind: 'product'; serviceId: string; product?: CampusProduct };

/** Integer-to-string formatting; never divides floats. */
function minorToDecimal(minor: number, scale: number) {
  const s = String(minor).padStart(scale + 1, '0');
  return `${s.slice(0, -scale)}.${s.slice(-scale)}`;
}

const CATEGORIES: CampusServiceInputCategory[] = ['food', 'books', 'printing', 'transportation', 'fees', 'other'];

function Shell({ open, onClose, title, desc, busy, error, onSubmit, t, children, edit }: { edit?: boolean; open: boolean; onClose: () => void; title: string; desc: string; busy: boolean; error: unknown; onSubmit: () => void; t: Tx; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto" data-testid="dialog-admin-catalog">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          {children}
          {edit ? <p className="type-caption text-muted-foreground" data-testid="text-parent-locked">{t('Parent location is fixed. To move it, create a new entry under the other parent.', 'الموقع الأب ثابت. لنقله، أنشئ عنصراً جديداً تحت الأب الآخر.')}</p> : null}
          {error ? <Notice tone="error" title={t('Not saved', 'لم يُحفظ')} body={apiErrorText(error, t)} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
            <Button type="submit" disabled={busy} aria-busy={busy} data-testid="button-save-catalog">{busy ? <Loader2 className="animate-spin" aria-hidden /> : null}{t('Save', 'حفظ')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Names({ name, ar, setName, setAr, errors, t }: { name: string; ar: string; setName: (v: string) => void; setAr: (v: string) => void; errors: Record<string, string>; t: Tx }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="cat-name" label={t('Name (English)', 'الاسم (إنجليزي)')} error={errors.name}><input id="cat-name" dir="ltr" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} className={inputClass} aria-invalid={!!errors.name} data-testid="input-catalog-name" /></Field>
      <Field id="cat-ar" label={t('Name (Arabic)', 'الاسم (عربي)')} error={errors.ar}><input id="cat-ar" dir="rtl" lang="ar" value={ar} maxLength={160} onChange={(e) => setAr(e.target.value)} className={inputClass} aria-invalid={!!errors.ar} data-testid="input-catalog-arabic" /></Field>
    </div>
  );
}

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col"><label htmlFor={id} className="type-label">{label}</label><span className="type-caption text-muted-foreground">{hint}</span></div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={`switch-${id}`} />
    </div>
  );
}

export function AdminCatalogDialog({ target, onClose, t }: { target: AdminTarget | null; onClose: () => void; t: Tx }) {
  const refresh = useRefreshFinance();
  const uniM = useCreateCampusUniversity(); const campusM = useCreateCampus();
  const svcC = useCreateCampusService(); const svcU = useUpdateCampusService();
  const prodC = useCreateCampusProduct(); const prodU = useUpdateCampusProduct();
  const [name, setName] = useState(''); const [ar, setAr] = useState('');
  const [category, setCategory] = useState<CampusServiceInputCategory>('food');
  const [description, setDescription] = useState(''); const [location, setLocation] = useState('');
  const [active, setActive] = useState(true); const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [price, setPrice] = useState(''); const [currency, setCurrency] = useState<AmountCurrency>('ILS');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!target) return;
    [uniM, campusM, svcC, svcU, prodC, prodU].forEach((m) => m.reset());
    const s = target.kind === 'service' ? target.service : undefined;
    const p = target.kind === 'product' ? target.product : undefined;
    const src = s ?? p;
    setName(src?.name ?? ''); setAr(src?.arabicName ?? ''); setCategory(s?.category ?? 'food');
    setDescription(s?.description ?? ''); setLocation(s?.location ?? ''); setActive(src?.active ?? true); setPaymentEnabled(s?.paymentEnabled ?? true);
    setCurrency(p?.price.currency ?? 'ILS');
    setPrice(p ? minorToDecimal(p.price.minor, p.price.currency === 'JOD' ? 3 : 2) : '');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;
  const done = () => { void refresh(); onClose(); };
  const baseErrors = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('Required.', 'مطلوب.');
    if (!ar.trim()) e.ar = t('Arabic name is required.', 'الاسم العربي مطلوب.');
    return e;
  };

  if (target.kind === 'university' || target.kind === 'campus') {
    const m = target.kind === 'university' ? uniM : campusM;
    const submit = () => {
      const e = baseErrors(); setErrors(e); if (Object.keys(e).length) return;
      if (target.kind === 'university') uniM.mutate({ data: { name: name.trim(), arabicName: ar.trim() } }, { onSuccess: done });
      else campusM.mutate({ data: { universityId: target.universityId, name: name.trim(), arabicName: ar.trim() } }, { onSuccess: done });
    };
    return (
      <Shell open onClose={onClose} t={t} busy={m.isPending} error={m.error} onSubmit={submit}
        title={target.kind === 'university' ? t('Add university', 'إضافة جامعة') : t('Add campus', 'إضافة حرم')}
        desc={t('Use fictional names for demo data. Real institutions need a signed integration.', 'استخدم أسماء وهمية للبيانات التجريبية. المؤسسات الحقيقية تحتاج تكاملاً موقعاً.')}>
        <Names name={name} ar={ar} setName={setName} setAr={setAr} errors={errors} t={t} />
      </Shell>
    );
  }

  if (target.kind === 'service') {
    const m = target.service ? svcU : svcC;
    const submit = () => {
      const e = baseErrors();
      if (description.length > 500) e.desc = t('Max 500 characters.', 'حد أقصى 500 حرف.');
      if (location.length > 300) e.loc = t('Max 300 characters.', 'حد أقصى 300 حرف.');
      setErrors(e); if (Object.keys(e).length) return;
      const data = { campusId: target.campusId, name: name.trim(), arabicName: ar.trim(), category, description: description.trim(), location: location.trim(), active, paymentEnabled };
      if (target.service) svcU.mutate({ id: target.service.id, data }, { onSuccess: done }); else svcC.mutate({ data }, { onSuccess: done });
    };
    return (
      <Shell edit={!!target.service} open onClose={onClose} t={t} busy={m.isPending} error={m.error} onSubmit={submit}
        title={target.service ? t('Edit service', 'تعديل الخدمة') : t('Add service', 'إضافة خدمة')} desc={t('Integration status is Simulated for every service in this prototype.', 'حالة التكامل «محاكاة» لكل خدمة في هذا النموذج.')}>
        <Names name={name} ar={ar} setName={setName} setAr={setAr} errors={errors} t={t} />
        <Field id="cat-category" label={t('Category', 'الفئة')}>
          <select id="cat-category" value={category} onChange={(e) => setCategory(e.target.value as CampusServiceInputCategory)} className={inputClass} data-testid="select-service-category">
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c]![0], CATEGORY_LABEL[c]![1])}</option>)}
          </select>
        </Field>
        <Field id="cat-desc" label={t('Description', 'الوصف')} error={errors.desc}><textarea id="cat-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} py-2`} data-testid="input-service-description" /></Field>
        <Field id="cat-loc" label={t('Location', 'الموقع')} error={errors.loc}><input id="cat-loc" maxLength={300} value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} data-testid="input-service-location" /></Field>
        <Toggle id="svc-active" label={t('Active', 'نشطة')} hint={t('Inactive services are hidden from students.', 'الخدمات غير النشطة مخفية عن الطلاب.')} checked={active} onChange={setActive} />
        <Toggle id="svc-pay" label={t('Payments available', 'الدفع متاح')} hint={t('Students can pay this service with simulated money.', 'يمكن للطلاب الدفع بمال محاكى.')} checked={paymentEnabled} onChange={setPaymentEnabled} />
      </Shell>
    );
  }

  const m = target.product ? prodU : prodC;
  const submit = () => {
    const e = baseErrors();
    const r = parseAmountInput(price, currency);
    if (!r.ok) e.price = amountErrorText(r.reason, currency, t);
    setErrors(e); if (Object.keys(e).length || !r.ok) return;
    const data = { serviceId: target.serviceId, name: name.trim(), arabicName: ar.trim(), price: { minor: r.value.minor, currency }, active };
    if (target.product) prodU.mutate({ id: target.product.id, data }, { onSuccess: done }); else prodC.mutate({ data }, { onSuccess: done });
  };
  return (
    <Shell edit={!!target.product} open onClose={onClose} t={t} busy={m.isPending} error={m.error} onSubmit={submit}
      title={target.product ? t('Edit item', 'تعديل العنصر') : t('Add item', 'إضافة عنصر')} desc={t('Demo prices only. Past receipts keep the price charged at the time.', 'أسعار تجريبية فقط. الإيصالات السابقة تحتفظ بالسعر وقت الدفع.')}>
      <Names name={name} ar={ar} setName={setName} setAr={setAr} errors={errors} t={t} />
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field id="cat-price" label={t('Demo price', 'السعر التجريبي')} error={errors.price}><AmountInput id="cat-price" value={price} onChange={setPrice} error={errors.price} /></Field>
        <Field id="cat-currency" label={t('Currency', 'العملة')}>
          <select id="cat-currency" value={currency} onChange={(e) => setCurrency(e.target.value as AmountCurrency)} className={inputClass} data-testid="select-product-currency">
            {(['ILS', 'USD', 'JOD'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Toggle id="prod-active" label={t('Active', 'نشط')} hint={t('Inactive items cannot be purchased.', 'لا يمكن شراء العناصر غير النشطة.')} checked={active} onChange={setActive} />
    </Shell>
  );
}
