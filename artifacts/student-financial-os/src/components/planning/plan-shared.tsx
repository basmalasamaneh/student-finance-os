import { useState, type ReactNode } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { AmountInput, Field, inputClass } from '@/components/money/fields';
import { CURRENCIES, type Currency } from '@/lib/money';
import { amountErrorText, parseAmountInput, type Tx } from '@/features/money/money-model';
import { CATEGORY, lbl, planErrorText } from '@/features/planning/planning-model';
import type { Amount, PlanningCategory } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

export function CategorySelect({ id, value, onChange, options, t }: { id: string; value: string; onChange: (v: PlanningCategory) => void; options: PlanningCategory[]; t: Tx }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as PlanningCategory)} className={cn(inputClass, 'appearance-auto')} data-testid={`select-${id}`}>
      {options.map((c) => <option key={c} value={c}>{lbl(CATEGORY, c, t)}</option>)}
    </select>
  );
}

export function EnumSelect({ id, value, onChange, options, map, t }: { id: string; value: string; onChange: (v: string) => void; options: readonly string[]; map: Record<string, [string, string]>; t: Tx }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, 'appearance-auto')} data-testid={`select-${id}`}>
      {options.map((o) => <option key={o} value={o}>{lbl(map, o, t)}</option>)}
    </select>
  );
}

/** Amount + currency pair. Parses decimal strings into exact integer minor units. */
export function AmountCurrencyFields({ idPrefix, amount, setAmount, currency, setCurrency, error, t, lockCurrency }: {
  idPrefix: string; amount: string; setAmount: (v: string) => void; currency: Currency; setCurrency: (c: Currency) => void; error?: string; t: Tx; lockCurrency?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
      <Field id={`${idPrefix}-amount`} label={t('Amount', 'المبلغ')} error={error}>
        <AmountInput id={`${idPrefix}-amount`} value={amount} onChange={setAmount} currency={currency} error={error} />
      </Field>
      <Field id={`${idPrefix}-currency`} label={t('Currency', 'العملة')}>
        <select id={`${idPrefix}-currency`} value={currency} disabled={lockCurrency} onChange={(e) => setCurrency(e.target.value as Currency)} className={cn(inputClass, 'appearance-auto')} data-testid={`select-${idPrefix}-currency`}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function parseAmount(raw: string, currency: Currency, t: Tx, allowZero = false): { amount?: Amount; error?: string } {
  const r = parseAmountInput(raw, currency);
  if (r.ok) return { amount: { minor: r.value.minor, currency } };
  if (allowZero && r.reason === 'zero') return { amount: { minor: 0, currency } };
  return { error: amountErrorText(r.reason, currency, t) };
}

export function RowActions({ onEdit, onDelete, t, testId }: { onEdit: () => void; onDelete: () => void; t: Tx; testId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" className="size-10" onClick={onEdit} aria-label={t('Edit', 'تعديل')} data-testid={`button-edit-${testId}`}><Pencil className="size-4" aria-hidden /></Button>
      <Button variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label={t('Delete', 'حذف')} data-testid={`button-delete-${testId}`}><Trash2 className="size-4" aria-hidden /></Button>
    </div>
  );
}

/** Delete confirmation with pending lock and inline retryable error. */
export function ConfirmDelete({ open, onOpenChange, title, body, onConfirm, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; onConfirm: () => Promise<unknown>; t: Tx;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function go() {
    setPending(true); setError(null);
    try { await onConfirm(); onOpenChange(false); } catch (e) { setError(e); } finally { setPending(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!pending) { setError(null); onOpenChange(o); } }}>
      <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-md" data-testid="dialog-confirm-delete">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <Notice tone="error" title={t('Not deleted', 'لم يُحذف')} body={planErrorText(error, t)} /> : null}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} data-testid="button-cancel-delete">{t('Keep it', 'إبقاء')}</AlertDialogCancel>
          <Button variant="destructive" onClick={() => void go()} disabled={pending} aria-busy={pending} data-testid="button-confirm-delete">
            {pending ? <><Loader2 className="animate-spin" aria-hidden />{t('Deleting…', 'جارٍ الحذف…')}</> : error ? t('Retry delete', 'أعد الحذف') : t('Delete', 'حذف')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SubmitButton({ pending, editing, t, testId }: { pending: boolean; editing: boolean; t: Tx; testId: string }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} data-testid={testId}>
      {pending ? <><Loader2 className="animate-spin" aria-hidden />{t('Saving…', 'جارٍ الحفظ…')}</> : editing ? t('Save changes', 'حفظ التغييرات') : t('Add', 'إضافة')}
    </Button>
  );
}

export function EmptyRow({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-input px-4 py-5" data-testid="state-empty">
      <div><p className="type-label">{title}</p><p className="type-caption max-w-prose text-muted-foreground">{body}</p></div>
      {action}
    </div>
  );
}
