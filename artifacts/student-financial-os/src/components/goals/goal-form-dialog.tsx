import { useEffect, useState, type FormEvent } from 'react';
import { useCreateSavingsGoal, useUpdateSavingsGoal, type SavingsGoal, type SavingsGoalInput, type SavingsGoalInputPriority } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AmountInput, Field, inputClass } from '@/components/money/fields';
import { amountErrorText, parseAmountInput, type Tx } from '@/features/money/money-model';
import { goalErrorText, useRefreshAfterGoalChange, useSubmissionKey } from '@/features/goals/goals-model';
import { minorToInput } from '@/features/planning/planning-model';
import { CURRENCIES, type Currency } from '@/lib/money';
import { cn } from '@/lib/utils';

type Draft = { name: string; amount: string; currency: Currency; targetDate: string; category: string; priority: SavingsGoalInputPriority; notes: string };
const blank: Draft = { name: '', amount: '', currency: 'ILS', targetDate: '', category: '', priority: 'medium', notes: '' };
const fromGoal = (g: SavingsGoal): Draft => ({ name: g.name, amount: minorToInput(g.target.minor, g.target.currency), currency: g.target.currency, targetDate: g.targetDate?.slice(0, 10) ?? '', category: g.category, priority: g.priority, notes: g.notes });

export function GoalFormDialog({ open, onOpenChange, goal, t, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: SavingsGoal; t: Tx; onSaved?: (g: SavingsGoal) => void }) {
  const [d, setD] = useState<Draft>(blank);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setD(goal ? fromGoal(goal) : blank); setTouched(false); } }, [open, goal]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const currencyLocked = !!goal && goal.current.minor > 0;
  const parsed = parseAmountInput(d.amount, d.currency);
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!d.name.trim()) errors.name = t('Give the goal a name.', 'اكتب اسماً للهدف.');
  else if (d.name.trim().length > 120) errors.name = t('Up to 120 characters.', 'حتى 120 حرفاً.');
  if (!parsed.ok) errors.amount = amountErrorText(parsed.reason, d.currency, t);
  else if (goal && parsed.value.minor < goal.current.minor) errors.amount = t('Target cannot be below what is already saved.', 'لا يمكن أن يقل الهدف عن المدّخر حالياً.');
  if (!d.category.trim()) errors.category = t('Add a category, e.g. Laptop or Travel.', 'أضف فئة، مثل حاسوب أو سفر.');
  else if (d.category.trim().length > 80) errors.category = t('Up to 80 characters.', 'حتى 80 حرفاً.');
  if (d.notes.length > 2000) errors.notes = t('Up to 2000 characters.', 'حتى 2000 حرف.');
  if (d.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.targetDate)) errors.targetDate = t('Use a valid date.', 'استخدم تاريخاً صحيحاً.');
  const valid = Object.keys(errors).length === 0;

  const payload: SavingsGoalInput | null = parsed.ok ? {
    name: d.name.trim(), target: { minor: parsed.value.minor, currency: d.currency }, targetDate: d.targetDate || null,
    category: d.category.trim(), priority: d.priority, notes: d.notes,
  } : null;
  const idem = useSubmissionKey(`${goal?.id ?? 'new'}|${JSON.stringify(payload)}`);
  const refresh = useRefreshAfterGoalChange();
  const create = useCreateSavingsGoal({ request: { headers: idem.headers } });
  const update = useUpdateSavingsGoal({ request: { headers: idem.headers } });
  const m = goal ? update : create;

  const submit = (e: FormEvent) => {
    e.preventDefault(); setTouched(true);
    if (!valid || !payload || m.isPending) return;
    const done = (g: SavingsGoal) => { idem.reset(); void refresh(); onSaved?.(g); onOpenChange(false); };
    if (goal) update.mutate({ id: goal.id, data: payload }, { onSuccess: done });
    else create.mutate({ data: payload }, { onSuccess: done });
  };
  const err = (k: keyof Draft) => (touched ? errors[k] : undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto" data-testid="dialog-goal-form">
        <DialogHeader>
          <DialogTitle>{goal ? t('Edit goal', 'تعديل الهدف') : t('New savings goal', 'هدف ادخار جديد')}</DialogTitle>
          <DialogDescription>{t('Saved amount, progress and estimates are calculated from real contributions — you never type them.', 'المبلغ المدّخر والتقدم والتقديرات تُحسب من المساهمات الفعلية — لا تكتبها أبداً.')}</DialogDescription>
        </DialogHeader>
        <form id="goal-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field id="goal-name" label={t('Name', 'الاسم')} error={err('name')}>
            <input id="goal-name" className={inputClass} value={d.name} maxLength={120} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err('name')} data-testid="input-goal-name" />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <Field id="goal-target" label={t('Target', 'المبلغ المستهدف')} error={err('amount')} hint={goal && goal.current.minor > 0 ? t(`At least ${minorToInput(goal.current.minor, goal.currency)} (already saved).`, `على الأقل ${minorToInput(goal.current.minor, goal.currency)} (مدّخر حالياً).`) : undefined}>
              <AmountInput id="goal-target" value={d.amount} onChange={(v) => set('amount', v)} currency={d.currency} error={err('amount')} />
            </Field>
            <Field id="goal-currency" label={t('Currency', 'العملة')} hint={currencyLocked ? t('Locked once funded', 'مقفلة بعد التمويل') : undefined}>
              <select id="goal-currency" className={cn(inputClass, 'appearance-auto')} value={d.currency} disabled={currencyLocked} onChange={(e) => set('currency', e.target.value as Currency)} data-testid="select-goal-currency">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="goal-date" label={t('Target date (optional)', 'التاريخ المستهدف (اختياري)')} error={err('targetDate')} hint={t('Without a date, no monthly requirement is forecast.', 'بدون تاريخ لا يُتوقع مبلغ شهري.')}>
              <div className="flex gap-2">
                <input id="goal-date" type="date" dir="ltr" className={inputClass} value={d.targetDate} onChange={(e) => set('targetDate', e.target.value)} data-testid="input-goal-date" />
                {d.targetDate ? <Button type="button" variant="ghost" className="min-h-11 shrink-0" onClick={() => set('targetDate', '')} data-testid="button-clear-date">{t('Clear', 'مسح')}</Button> : null}
              </div>
            </Field>
            <Field id="goal-priority" label={t('Priority', 'الأولوية')}>
              <select id="goal-priority" className={cn(inputClass, 'appearance-auto')} value={d.priority} onChange={(e) => set('priority', e.target.value as SavingsGoalInputPriority)} data-testid="select-goal-priority">
                <option value="low">{t('Low', 'منخفضة')}</option><option value="medium">{t('Medium', 'متوسطة')}</option><option value="high">{t('High', 'عالية')}</option>
              </select>
            </Field>
          </div>
          <Field id="goal-category" label={t('Category', 'الفئة')} error={err('category')}>
            <input id="goal-category" className={inputClass} value={d.category} maxLength={80} onChange={(e) => set('category', e.target.value)} placeholder={t('Laptop, travel, emergency…', 'حاسوب، سفر، طوارئ…')} aria-invalid={!!err('category')} data-testid="input-goal-category" />
          </Field>
          <Field id="goal-notes" label={t('Notes (private)', 'ملاحظات (خاصة)')} error={err('notes')} hint={t(`${d.notes.length}/2000 · never shared with a parent`, `${d.notes.length}/2000 · لا تُشارك مع الأهل أبداً`)}>
            <textarea id="goal-notes" rows={3} className={cn(inputClass, 'py-2')} value={d.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} data-testid="input-goal-notes" />
          </Field>
          {m.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-goal-form">{goalErrorText(m.error, t)}</p> : null}
        </form>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending} data-testid="button-cancel-goal">{t('Cancel', 'إلغاء')}</Button>
          <Button type="submit" form="goal-form" disabled={m.isPending || (touched && !valid)} data-testid="button-save-goal">
            {m.isPending ? t('Saving…', 'جارٍ الحفظ…') : m.isError ? t('Retry save', 'أعد الحفظ') : goal ? t('Save changes', 'حفظ التغييرات') : t('Create goal', 'إنشاء الهدف')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
