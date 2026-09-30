import { useEffect, useState } from 'react';
import { useCreatePlanLine, useUpdatePlanLine, type PlanLine, type PlanLineInputType, type PlanningCategory } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { Field, inputClass } from '@/components/money/fields';
import type { Currency } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { EXPENSE_CATEGORIES, isValidIsoDate, LINE_TYPE, minorToInput, planErrorText, useRefreshPlan } from '@/features/planning/planning-model';
import { AmountCurrencyFields, CategorySelect, EnumSelect, parseAmount, SubmitButton } from './plan-shared';

export function LineDialog({ open, onOpenChange, line, t }: { open: boolean; onOpenChange: (o: boolean) => void; line?: PlanLine; t: Tx }) {
  const [type, setType] = useState<PlanLineInputType>('variable');
  const [category, setCategory] = useState<PlanningCategory>('food');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; date?: string; desc?: string }>({});
  const refresh = useRefreshPlan();
  const create = useCreatePlanLine();
  const update = useUpdatePlanLine();
  const m = line ? update : create;

  useEffect(() => {
    if (!open) return;
    setType(line?.type ?? 'variable'); setCategory(line?.category ?? 'food');
    setCurrency((line?.amount.currency as Currency) ?? 'ILS'); setAmount(line ? minorToInput(line.amount.minor, line.amount.currency) : '');
    setDescription(line?.description ?? ''); setDate(line?.upcomingDate ?? '');
    setErrors({}); create.reset(); update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line]);

  function changeType(v: PlanLineInputType) {
    setType(v);
    if (v === 'savings') setCategory('savings'); else if (category === 'savings') setCategory('food');
  }

  function submit() {
    if (m.isPending) return;
    const p = parseAmount(amount, currency, t);
    const e: typeof errors = {};
    if (!p.amount) e.amount = p.error;
    if (date && !isValidIsoDate(date)) e.date = t('Choose a valid date or leave it empty.', 'اختر تاريخاً صحيحاً أو اتركه فارغاً.');
    if (description.length > 300) e.desc = t('300 characters max.', '300 حرف كحد أقصى.');
    setErrors(e);
    if (Object.keys(e).length || !p.amount) return;
    const data = { type, category: type === 'savings' ? 'savings' as const : category, amount: p.amount, description: description.trim(), ...(date ? { upcomingDate: date } : {}) };
    const done = { onSuccess: () => { void refresh(); onOpenChange(false); } };
    if (line) update.mutate({ id: line.id, data }, done); else create.mutate({ data }, done);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-line">
        <DialogHeader>
          <DialogTitle>{line ? t('Edit plan line', 'تعديل بند الخطة') : t('New plan line', 'بند خطة جديد')}</DialogTitle>
          <DialogDescription>{t('A monthly estimate. A manual line replaces recurring and profile amounts in the same category and currency.', 'تقدير شهري. البند اليدوي يحلّ محل المتكرر وقيم الملف في نفس الفئة والعملة.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
          <Field id="line-type" label={t('Type', 'النوع')}><EnumSelect id="line-type" value={type} onChange={(v) => changeType(v as PlanLineInputType)} options={['fixed', 'variable', 'savings']} map={LINE_TYPE} t={t} /></Field>
          {type !== 'savings' ? (
            <Field id="line-category" label={t('Category', 'الفئة')}><CategorySelect id="line-category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} t={t} /></Field>
          ) : <p className="type-caption text-muted-foreground">{t('Savings lines use the Savings category and count only in planned savings.', 'بنود الادخار تستخدم فئة الادخار وتُحتسب في الادخار المخطط فقط.')}</p>}
          <AmountCurrencyFields idPrefix="line" amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} error={errors.amount} t={t} />
          <Field id="line-description" label={t('Description', 'الوصف')} error={errors.desc} hint={t('Optional.', 'اختياري.')}>
            <input id="line-description" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} className={inputClass} data-testid="input-line-description" />
          </Field>
          <Field id="line-date" label={t('Upcoming date (optional)', 'التاريخ القادم (اختياري)')} error={errors.date} hint={t('Informational only.', 'للعلم فقط.')}>
            <input id="line-date" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} data-testid="input-line-date" />
          </Field>
          {m.isError ? <Notice tone="error" title={t('Not saved', 'لم يُحفظ')} body={planErrorText(m.error, t)} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <SubmitButton pending={m.isPending} editing={!!line} t={t} testId="button-save-line" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
