import { useEffect, useState } from 'react';
import {
  useCreateScheduledItem, useUpdateScheduledItem,
  type PlanningCategory, type ScheduledItem, type ScheduledItemInput, type ScheduledKind, type ScheduledRecurrence, type ScheduledStatus,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { Field, inputClass } from '@/components/money/fields';
import { AmountCurrencyFields, CategorySelect, EnumSelect, parseAmount, SubmitButton } from '@/components/planning/plan-shared';
import type { Currency } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { isValidIsoDate, minorToInput, PLAN_CATEGORIES } from '@/features/planning/planning-model';
import { ADDITIONAL_NOTICE, KIND, STATUS, RECURRENCE, upcomingErrorText, useRefreshUpcoming, utcToday } from '@/features/upcoming/upcoming-model';
import { cn } from '@/lib/utils';

const KINDS = ['expense', 'income', 'savings'] as const;
const RECS = ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

export function ScheduledDialog({ open, onOpenChange, item, t }: { open: boolean; onOpenChange: (o: boolean) => void; item?: ScheduledItem; t: Tx }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ScheduledKind>('expense');
  const [category, setCategory] = useState<PlanningCategory>('other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<ScheduledRecurrence>('none');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ScheduledStatus>('planned');
  const [errors, setErrors] = useState<{ name?: string; amount?: string; due?: string; end?: string; status?: string }>({});
  const refresh = useRefreshUpcoming();
  const create = useCreateScheduledItem();
  const update = useUpdateScheduledItem();
  const m = item ? update : create;

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? ''); setKind(item?.kind ?? 'expense'); setCategory(item?.category ?? 'other');
    setCurrency((item?.amount.currency as Currency) ?? 'ILS'); setAmount(item ? minorToInput(item.amount.minor, item.amount.currency) : '');
    setDueDate(item?.dueDate ?? utcToday()); setRecurrence(item?.recurrence ?? 'none'); setEndDate(item?.endDate ?? ''); setNotes(item?.notes ?? ''); setStatus(item?.status ?? 'planned');
    setErrors({}); create.reset(); update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  function submit() {
    if (m.isPending) return;
    const p = parseAmount(amount, currency, t);
    const e: typeof errors = {};
    if (!name.trim()) e.name = t('Give it a name.', 'أعطه اسماً.');
    if (!p.amount) e.amount = p.error;
    if (!isValidIsoDate(dueDate)) e.due = t('Choose a valid due date.', 'اختر تاريخ استحقاق صحيحاً.');
    if (endDate && (!isValidIsoDate(endDate) || endDate < dueDate)) e.end = t('End date must be on or after the due date.', 'يجب أن يكون تاريخ الانتهاء في يوم الاستحقاق أو بعده.');
    setErrors(e);
    if (Object.keys(e).length || !p.amount) return;
    // Recurring series cannot be "completed" as a whole — keep a completed one-off only if still one-off.
    if (status === 'completed' && recurrence !== 'none') { setErrors({ ...e, status: t('A repeating series cannot be marked done as a whole. Mark individual dates instead.', 'لا يمكن تعليم سلسلة متكررة كمنجزة كاملة. علّم التواريخ منفردة.') }); return; }
    const data: ScheduledItemInput = {
      name: name.trim(), amount: { minor: p.amount.minor, currency }, dueDate, category, kind, notes: notes.trim(), recurrence, status,
      ...(recurrence !== 'none' && endDate ? { endDate } : {}),
    };
    const done = { onSuccess: () => { void refresh(); onOpenChange(false); } };
    if (item) update.mutate({ id: item.id, data }, done); else create.mutate({ data }, done);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto" data-testid="dialog-scheduled">
        <DialogHeader>
          <DialogTitle>{item ? t('Edit scheduled item', 'تعديل بند مجدول') : t('New scheduled item', 'بند مجدول جديد')}</DialogTitle>
          <DialogDescription>{t('A planned date for your own forecast. Nothing is charged or paid.', 'تاريخ مخطط لتوقعاتك فقط. لا يُخصم أو يُدفع شيء.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
          <Notice tone="info" title={t('Additional commitment', 'التزام إضافي')} body={t(...ADDITIONAL_NOTICE)} />
          <Field id="sch-name" label={t('Name', 'الاسم')} error={errors.name}>
            <input id="sch-name" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} className={inputClass} aria-invalid={!!errors.name} data-testid="input-sch-name" />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="type-label pb-2">{t('Type', 'النوع')}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`radio-kind-${k}`}
                  className={cn('min-h-11 rounded-[14px] border px-2 type-label transition-colors', kind === k ? 'border-primary bg-primary-soft text-gold-ink' : 'border-input bg-surface text-foreground hover:border-foreground/30')}>
                  {t(...KIND[k])}
                </button>
              ))}
            </div>
          </fieldset>
          <AmountCurrencyFields idPrefix="sch" amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} error={errors.amount} t={t} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="sch-category" label={t('Category', 'الفئة')}><CategorySelect id="sch-category" value={category} onChange={setCategory} options={PLAN_CATEGORIES} t={t} /></Field>
            <Field id="sch-recurrence" label={t('Repeats', 'التكرار')}><EnumSelect id="sch-recurrence" value={recurrence} onChange={(v) => setRecurrence(v as ScheduledRecurrence)} options={RECS} map={RECURRENCE} t={t} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="sch-due" label={recurrence === 'none' ? t('Due date', 'تاريخ الاستحقاق') : t('First date', 'أول تاريخ')} error={errors.due}>
              <input id="sch-due" type="date" dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} aria-invalid={!!errors.due} data-testid="input-sch-due" />
            </Field>
            {recurrence !== 'none' ? (
              <Field id="sch-end" label={t('End date (optional)', 'تاريخ الانتهاء (اختياري)')} error={errors.end} hint={t('Inclusive. Leave empty to keep repeating.', 'شامل. اتركه فارغاً للاستمرار.')}>
                <input id="sch-end" type="date" dir="ltr" value={endDate} min={dueDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} aria-invalid={!!errors.end} data-testid="input-sch-end" />
              </Field>
            ) : null}
          </div>
          {item ? <p className="type-caption text-muted-foreground">{t('If some dates are already marked done or cancelled, the date, repeat and end date cannot change.', 'إذا كانت بعض التواريخ معلّمة كمنجزة أو ملغاة، فلا يمكن تغيير التاريخ والتكرار والنهاية.')}</p> : null}
          {item ? (
            <Field id="sch-status" label={recurrence === 'none' ? t('Item status', 'حالة البند') : t('Series status', 'حالة السلسلة')} error={errors.status}
              hint={recurrence === 'none' ? t('Plan only — never posts a payment.', 'خطة فقط — لا يسجّل أي دفعة.') : t('Ending a series keeps dates you already marked. Restarting does not change them either.', 'إنهاء السلسلة يحتفظ بالتواريخ المعلّمة. وإعادة التشغيل لا تغيّرها أيضاً.')}>
              <EnumSelect id="sch-status" value={status} onChange={(v) => setStatus(v as ScheduledStatus)} options={recurrence === 'none' ? ['planned', 'completed', 'cancelled'] : ['planned', 'cancelled']}
                map={recurrence === 'none' ? STATUS : { planned: ['Active', 'نشطة'], cancelled: ['Ended (cancelled)', 'منتهية (ملغاة)'] }} t={t} />
            </Field>
          ) : null}
          <Field id="sch-notes" label={t('Notes (optional)', 'ملاحظات (اختياري)')}>
            <textarea id="sch-notes" value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} className={cn(inputClass, 'py-3')} data-testid="input-sch-notes" />
          </Field>
          {m.isError ? <Notice tone="error" title={t('Not saved', 'لم يُحفظ')} body={upcomingErrorText(m.error, t)} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <SubmitButton pending={m.isPending} editing={!!item} t={t} testId="button-save-scheduled" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
