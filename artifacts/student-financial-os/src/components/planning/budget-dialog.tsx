import { useEffect, useState } from 'react';
import { useCreateBudget, useUpdateBudget, type Budget, type BudgetInputPeriod, type PlanningCategory } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { Field } from '@/components/money/fields';
import type { Currency } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { EXPENSE_CATEGORIES, minorToInput, planErrorText, useRefreshPlan } from '@/features/planning/planning-model';
import { AmountCurrencyFields, CategorySelect, EnumSelect, parseAmount, SubmitButton } from './plan-shared';

const PERIODS: Record<string, [string, string]> = { weekly: ['Weekly (UTC Mon–Sun)', 'أسبوعي (الاثنين–الأحد UTC)'], monthly: ['Monthly (UTC calendar month)', 'شهري (شهر ميلادي UTC)'] };

export function BudgetDialog({ open, onOpenChange, budget, t }: { open: boolean; onOpenChange: (o: boolean) => void; budget?: Budget; t: Tx }) {
  const [category, setCategory] = useState<PlanningCategory>('food');
  const [period, setPeriod] = useState<BudgetInputPeriod>('monthly');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [error, setError] = useState('');
  const refresh = useRefreshPlan();
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const m = budget ? update : create;

  useEffect(() => {
    if (!open) return;
    setCategory(budget?.category ?? 'food'); setPeriod(budget?.period ?? 'monthly');
    setCurrency((budget?.limit.currency as Currency) ?? 'ILS'); setAmount(budget ? minorToInput(budget.limit.minor, budget.limit.currency) : '');
    setError(''); create.reset(); update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget]);

  function submit() {
    if (m.isPending) return;
    const p = parseAmount(amount, currency, t);
    if (!p.amount) { setError(p.error ?? ''); return; }
    setError('');
    const data = { category, period, limit: p.amount };
    const done = { onSuccess: () => { void refresh(); onOpenChange(false); } };
    if (budget) update.mutate({ id: budget.id, data }, done); else create.mutate({ data }, done);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-budget">
        <DialogHeader>
          <DialogTitle>{budget ? t('Edit budget', 'تعديل الميزانية') : t('New budget', 'ميزانية جديدة')}</DialogTitle>
          <DialogDescription>{t('A limit to compare real spending against. It is not added to planned expenses.', 'حدّ لمقارنة الإنفاق الفعلي به. لا يُضاف إلى المصاريف المخططة.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field id="budget-category" label={t('Category', 'الفئة')}><CategorySelect id="budget-category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} t={t} /></Field>
          <Field id="budget-period" label={t('Period', 'الفترة')}><EnumSelect id="budget-period" value={period} onChange={(v) => setPeriod(v as BudgetInputPeriod)} options={['weekly', 'monthly']} map={PERIODS} t={t} /></Field>
          <AmountCurrencyFields idPrefix="budget" amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} error={error} t={t} />
          {m.isError ? <Notice tone="error" title={t('Budget not saved', 'لم تُحفظ الميزانية')} body={planErrorText(m.error, t, 'budget')} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <SubmitButton pending={m.isPending} editing={!!budget} t={t} testId="button-save-budget" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
