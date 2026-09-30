import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useCreateMoneyRequest, type FinanceAccount, type MoneyRequest } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlowSteps, SuccessCheck } from '@/components/money/flow-steps';
import { MoneyDisplay } from '@/components/finance/money-display';
import { Notice } from '@/components/states/state-panel';
import { AccountSelect, AmountInput, Field, inputClass, ReviewRow, SimulatedNote } from './fields';
import { accountName, amountErrorText, apiErrorText, parseAmountInput, useIdempotencyKey, useRefreshFinance, type Tx } from '@/features/money/money-model';
import type { Currency, Money } from '@/lib/money';
import { SensitiveReference } from '@/features/security/sensitive-reference';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function RequestDialog({ open, onOpenChange, accounts, t }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: FinanceAccount[]; t: Tx }) {
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form');
  const [accountId, setAccountId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<Money | null>(null);
  const [created, setCreated] = useState<MoneyRequest | null>(null);
  const idem = useIdempotencyKey();
  const refresh = useRefreshFinance();
  const mutation = useCreateMoneyRequest({ request: { headers: idem.headers } });

  useEffect(() => {
    if (open) {
      setStep('form'); setAccountId(accounts.length === 1 ? accounts[0]!.id : ''); setPayerId(''); setAmountRaw(''); setNote('');
      setErrors({}); setAmount(null); setCreated(null); idem.renew(); mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency as Currency | undefined;
  const payer = payerId.trim();

  function validate() {
    const e: Record<string, string> = {};
    if (!account) e.req_account = t('Choose the account that receives the money.', 'اختر الحساب الذي يستلم المال.');
    if (!payer) e.req_payer = t('Enter the payer account ID.', 'أدخل معرّف حساب الدافع.');
    else if (!UUID.test(payer)) e.req_payer = t('That is not a valid account ID format.', 'صيغة معرّف الحساب غير صحيحة.');
    else if (accounts.some((a) => a.id === payer)) e.req_payer = t('You cannot request from your own account.', 'لا يمكنك الطلب من حسابك.');
    let parsed: Money | null = null;
    if (currency) {
      const r = parseAmountInput(amountRaw, currency);
      if (r.ok) parsed = r.value; else e.req_amount = amountErrorText(r.reason, currency, t);
    }
    setErrors(e);
    if (!Object.keys(e).length && parsed) { setAmount(parsed); setStep('review'); }
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function confirm() {
    if (!account || !amount || mutation.isPending) return;
    mutation.mutate({ data: { recipientAccountId: account.id, payerAccountId: payer, amount: { minor: amount.minor, currency: amount.currency }, ...(note.trim() ? { note: note.trim() } : {}) } }, {
      onSuccess: (r) => { setCreated(r); setStep('done'); idem.renew(); void refresh(); },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-request">
        <DialogHeader>
          <DialogTitle>{step === 'done' ? t('Request sent', 'تم إرسال الطلب') : step === 'review' ? t('Review request', 'مراجعة الطلب') : t('Request money', 'طلب مال')}</DialogTitle>
          <DialogDescription>{t('The payer sees it as pending and chooses to pay or decline. No money moves until they pay.', 'يراه الدافع معلّقاً ويختار الدفع أو الرفض. لا يتحرك مال حتى يدفع.')}</DialogDescription>
          <span className="type-caption w-fit rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-gold-ink">{t('Simulated', 'محاكاة')}</span>
        </DialogHeader>
        <FlowSteps label={t('Progress', 'التقدم')} current={step === 'form' ? 0 : step === 'review' ? 1 : 2} steps={[t('Details', 'التفاصيل'), t('Review', 'مراجعة'), t('Done', 'تم')]} />
        {step === 'form' && (
          <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); validate(); }}>
            <Field id="req_account" label={t('Receive into', 'الاستلام في')} error={errors.req_account}>
              <AccountSelect id="req_account" value={accountId} onChange={setAccountId} accounts={accounts} t={t} error={errors.req_account} />
            </Field>
            <Field id="req_payer" label={t('Payer account ID', 'معرّف حساب الدافع')} error={errors.req_payer} hint={t('Their account must use the same currency.', 'يجب أن يكون حسابه بنفس العملة.')}>
              <input id="req_payer" type="text" inputMode="text" dir="ltr" autoComplete="off" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" spellCheck={false} value={payerId} onChange={(e) => setPayerId(e.target.value)} className={`${inputClass} tabular text-xs`}
                aria-invalid={!!errors.req_payer} aria-describedby={errors.req_payer ? 'req_payer-error' : 'req_payer-hint'} data-testid="input-payer" />
            </Field>
            <Field id="req_amount" label={t('Amount', 'المبلغ')} error={errors.req_amount}>
              <AmountInput id="req_amount" value={amountRaw} onChange={setAmountRaw} currency={currency} error={errors.req_amount} />
            </Field>
            <Field id="req_note" label={t('What is it for? (optional)', 'لأي غرض؟ (اختياري)')}>
              <input id="req_note" type="text" inputMode="text" autoComplete="off" enterKeyHint="done" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputClass} data-testid="input-request-note" />
            </Field>
            <DialogFooter className="form-action-bar gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={!currency} data-testid="button-review-request">{t('Review', 'مراجعة')}</Button>
            </DialogFooter>
          </form>
        )}
        {step === 'review' && account && amount && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-center py-2"><MoneyDisplay value={amount} size="xl" /></div>
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Receive into', 'الاستلام في')}>{accountName(account, t)}</ReviewRow>
              <ReviewRow label={t('Payer account', 'حساب الدافع')}><SensitiveReference value={payer} label={t('Payer account', 'حساب الدافع')} copy /></ReviewRow>
              {note.trim() ? <ReviewRow label={t('Note', 'ملاحظة')}>{note.trim()}</ReviewRow> : null}
            </dl>
            {mutation.isError ? <Notice tone="error" title={t('Not sent', 'لم يُرسل')} body={apiErrorText(mutation.error, t)} /> : null}
            <SimulatedNote t={t} />
            <DialogFooter className="form-action-bar gap-2">
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setStep('form'); idem.renew(); mutation.reset(); }}><ArrowLeft className="rtl:rotate-180" aria-hidden />{t('Edit', 'تعديل')}</Button>
              <Button onClick={confirm} loading={mutation.isPending} data-testid="button-confirm-request">
                {t('Send request', 'إرسال الطلب')}
              </Button>
            </DialogFooter>
          </div>
        )}
        {step === 'done' && created && (
          <div className="motion-rise card-premium flex flex-col items-center gap-3 rounded-card border p-5 text-center">
            <SuccessCheck label={t('Request sent', 'تم إرسال الطلب')} />
            <MoneyDisplay value={created.amount} size="lg" />
            <p className="type-label text-muted-foreground">{t('Pending until the payer responds.', 'معلّق حتى يرد الدافع.')}</p>
            <SimulatedNote t={t} />
            <DialogFooter className="form-action-bar w-full"><Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>{t('Done', 'تم')}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
