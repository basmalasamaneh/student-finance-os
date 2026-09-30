import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCreateCampusPayment, type CampusProduct, type CampusService, type FinanceAccount, type FinanceTransaction } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { Notice } from '@/components/states/state-panel';
import { Field, ReviewRow, SimulatedNote } from '@/components/money/fields';
import { Receipt } from '@/components/money/receipt';
import { accountName, apiErrorText, exactLine, exactSub, useIdempotencyKey, useRefreshFinance, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';
import type { Money } from '@/lib/money';

export type CartLine = { product: CampusProduct; quantity: number };

export function CheckoutDialog({ open, onOpenChange, service, lines, total, accounts, serviceName, onPaid, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; service: CampusService; lines: CartLine[]; total: Money; accounts: FinanceAccount[]; serviceName: string; onPaid: () => void; t: Tx;
}) {
  const [step, setStep] = useState<'account' | 'review' | 'done'>('account');
  const [accountId, setAccountId] = useState('');
  const [receipt, setReceipt] = useState<FinanceTransaction | null>(null);
  const idem = useIdempotencyKey();
  const refresh = useRefreshFinance();
  const mutation = useCreateCampusPayment({ request: { headers: idem.headers } });
  const eligible = useMemo(() => accounts.filter((a) => a.currency === total.currency), [accounts, total.currency]);

  useEffect(() => {
    if (open) {
      const wallet = eligible.find((a) => a.type === 'wallet' && a.balance.minor >= total.minor) ?? eligible.find((a) => a.balance.minor >= total.minor);
      setStep('account'); setAccountId(wallet?.id ?? ''); setReceipt(null); idem.renew(); mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const account = eligible.find((a) => a.id === accountId);
  const enough = !!account && account.balance.minor >= total.minor;
  const after: Money | null = account && enough ? exactSub(account.balance, total) : null;

  function pay() {
    if (!account || !enough || mutation.isPending) return;
    mutation.mutate({ data: { accountId: account.id, serviceId: service.id, items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })) } }, {
      onSuccess: (tx) => { setReceipt(tx); setStep('done'); idem.renew(); void refresh(); onPaid(); },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-checkout">
        <DialogHeader>
          <DialogTitle>{step === 'done' ? t('Payment receipt', 'إيصال الدفع') : step === 'review' ? t('Confirm payment', 'تأكيد الدفع') : t('Pay with', 'الدفع من')}</DialogTitle>
          <DialogDescription>{serviceName}</DialogDescription>
        </DialogHeader>

        {step === 'account' && (
          <div className="flex flex-col gap-4">
            <Field id="pay-account" label={t(`Eligible ${total.currency} accounts`, `حسابات مؤهلة بعملة ${total.currency}`)}>
              {eligible.length ? (
                <div role="radiogroup" aria-labelledby="pay-account" className="flex flex-col gap-2" id="pay-account">
                  {eligible.map((a) => {
                    const ok = a.balance.minor >= total.minor;
                    return (
                      <label key={a.id} className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 transition-colors', accountId === a.id ? 'border-primary bg-primary-soft' : 'border-input hover:bg-muted')}>
                        <input type="radio" name="pay-account" checked={accountId === a.id} onChange={() => setAccountId(a.id)} className="accent-[hsl(var(--primary))]" data-testid={`radio-account-${a.id}`} />
                        <span className="flex min-w-0 flex-1 flex-col"><span className="type-label truncate">{accountName(a, t)}</span>
                          {!ok ? <span className="type-caption text-destructive">{t('Insufficient balance', 'رصيد غير كافٍ')}</span> : null}</span>
                        <MoneyDisplay value={a.balance} size="sm" />
                      </label>
                    );
                  })}
                </div>
              ) : <Notice tone="warning" title={t('No eligible account', 'لا يوجد حساب مؤهل')} body={t(`Create a ${total.currency} account on the Money page and add simulated funds.`, `أنشئ حساباً بعملة ${total.currency} في صفحة المال وأضف أموالاً محاكاة.`)} />}
            </Field>
            {account && !enough ? <Notice tone="error" title={t('Insufficient balance', 'رصيد غير كافٍ')} body={t('Choose another account or add money first.', 'اختر حساباً آخر أو أضف مالاً أولاً.')} /> : null}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel', 'إلغاء')}</Button>
              <Button disabled={!enough} onClick={() => setStep('review')} data-testid="button-checkout-review">{t('Review', 'مراجعة')}</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'review' && account && after && (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-divider border-y border-divider">
              {lines.map((l) => { const lt = exactLine(l.product.price, l.quantity); return (
                <li key={l.product.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="type-label min-w-0">{t(l.product.name, l.product.arabicName)} <span className="tabular text-muted-foreground">× {l.quantity}</span></span>
                  {lt ? <MoneyDisplay value={lt} size="sm" /> : <span className="text-destructive">—</span>}
                </li>
              ); })}
            </ul>
            <dl className="divide-y divide-divider">
              <ReviewRow label={t('Total', 'الإجمالي')}><MoneyDisplay value={total} size="md" testId="text-checkout-total" /></ReviewRow>
              <ReviewRow label={t('Account', 'الحساب')}>{accountName(account, t)}</ReviewRow>
              <ReviewRow label={t('Balance before', 'الرصيد قبل')}><MoneyDisplay value={account.balance} size="sm" /></ReviewRow>
              <ReviewRow label={t('Balance after', 'الرصيد بعد')}><MoneyDisplay value={after} size="sm" /></ReviewRow>
            </dl>
            <p className="type-caption text-muted-foreground">{t('Prices are confirmed by the server at payment time.', 'يؤكد الخادم الأسعار لحظة الدفع.')}</p>
            {mutation.isError ? <Notice tone="error" title={t('Payment not completed', 'لم يكتمل الدفع')} body={apiErrorText(mutation.error, t)} /> : null}
            <SimulatedNote t={t} />
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setStep('account'); idem.renew(); mutation.reset(); }}><ArrowLeft className="rtl:rotate-180" aria-hidden />{t('Back', 'رجوع')}</Button>
              <Button onClick={pay} disabled={mutation.isPending} aria-busy={mutation.isPending} data-testid="button-confirm-payment">
                {mutation.isPending ? <><Loader2 className="animate-spin" aria-hidden />{t('Paying…', 'جارٍ الدفع…')}</> : mutation.isError ? t('Retry safely', 'أعد المحاولة بأمان') : t('Confirm simulated payment', 'تأكيد الدفع المحاكى')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && receipt && (
          <>
            <Receipt tx={receipt} account={account} t={t} />
            <DialogFooter><Button onClick={() => onOpenChange(false)} data-testid="button-receipt-done">{t('Done', 'تم')}</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
