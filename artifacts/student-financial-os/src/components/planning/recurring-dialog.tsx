import { useEffect, useState } from 'react';
import { useCreateRecurringExpense, useUpdateRecurringExpense, type PlanningCategory, type RecurringExpense, type RecurringExpenseInputFrequency } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Notice } from '@/components/states/state-panel';
import { Field, inputClass } from '@/components/money/fields';
import type { Currency } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { EXPENSE_CATEGORIES, FREQUENCY, isValidIsoDate, minorToInput, planErrorText, useRefreshPlan } from '@/features/planning/planning-model';
import { AmountCurrencyFields, CategorySelect, EnumSelect, parseAmount, SubmitButton } from './plan-shared';

const FREQS = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

export function RecurringDialog({ open, onOpenChange, item, t }: { open: boolean; onOpenChange: (o: boolean) => void; item?: RecurringExpense; t: Tx }) {
  const [category, setCategory] = useState<PlanningCategory>('subscriptions');
  const [frequency, setFrequency] = useState<RecurringExpenseInputFrequency>('monthly');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [nextDate, setNextDate] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ amount?: string; date?: string; desc?: string }>({});
  const refresh = useRefreshPlan();
  const create = useCreateRecurringExpense();
  const update = useUpdateRecurringExpense();
  const m = item ? update : create;

  useEffect(() => {
    if (!open) return;
    setCategory(item?.category ?? 'subscriptions'); setFrequency(item?.frequency ?? 'monthly');
    setCurrency((item?.amount.currency as Currency) ?? 'ILS'); setAmount(item ? minorToInput(item.amount.minor, item.amount.currency) : '');
    setNextDate(item?.nextDate ?? ''); setDescription(item?.description ?? ''); setActive(item?.active ?? true);
    setErrors({}); create.reset(); update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  function submit() {
    if (m.isPending) return;
    const p = parseAmount(amount, currency, t);
    const e: typeof errors = {};
    if (!p.amount) e.amount = p.error;
    if (!isValidIsoDate(nextDate)) e.date = t('Choose a valid next date.', 'اختر تاريخاً قادماً صحيحاً.');
    if (description.length > 300) e.desc = t('300 characters max.', '300 حرف كحد أقصى.');
    setErrors(e);
    if (Object.keys(e).length || !p.amount) return;
    const data = { category, frequency, amount: p.amount, nextDate, description: description.trim(), active };
    const done = { onSuccess: () => { void refresh(); onOpenChange(false); } };
    if (item) update.mutate({ id: item.id, data }, done); else create.mutate({ data }, done);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-recurring">
        <DialogHeader>
          <DialogTitle>{item ? t('Edit recurring expense', 'تعديل مصروف متكرر') : t('New recurring expense', 'مصروف متكرر جديد')}</DialogTitle>
          <DialogDescription>{t('Planned only. It appears in upcoming items and never charges an account.', 'مخطط فقط. يظهر في البنود القادمة ولا يخصم من أي حساب.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
          <Field id="rec-description" label={t('Description', 'الوصف')} error={errors.desc} hint={t('Optional, e.g. phone plan.', 'اختياري، مثل باقة الهاتف.')}>
            <input id="rec-description" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} className={inputClass} data-testid="input-rec-description" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="rec-category" label={t('Category', 'الفئة')}><CategorySelect id="rec-category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} t={t} /></Field>
            <Field id="rec-frequency" label={t('Frequency', 'التكرار')}><EnumSelect id="rec-frequency" value={frequency} onChange={(v) => setFrequency(v as RecurringExpenseInputFrequency)} options={FREQS} map={FREQUENCY} t={t} /></Field>
          </div>
          <AmountCurrencyFields idPrefix="rec" amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} error={errors.amount} t={t} />
          <Field id="rec-date" label={t('Next date', 'التاريخ القادم')} error={errors.date}>
            <input id="rec-date" type="date" dir="ltr" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputClass} aria-invalid={!!errors.date} data-testid="input-rec-date" />
          </Field>
          <label className="type-label flex min-h-11 items-center justify-between gap-3">
            {t('Active (counts in the plan)', 'نشط (يُحتسب في الخطة)')}
            <Switch checked={active} onCheckedChange={setActive} data-testid="switch-rec-active" />
          </label>
          {m.isError ? <Notice tone="error" title={t('Not saved', 'لم يُحفظ')} body={planErrorText(m.error, t)} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <SubmitButton pending={m.isPending} editing={!!item} t={t} testId="button-save-recurring" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
