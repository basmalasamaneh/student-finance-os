import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCreateFinanceAccount, type FinanceAccountInputCurrency, type FinanceAccountInputType } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { Field, inputClass } from './fields';
import { ACCOUNT_TYPE_LABEL, apiErrorText, useIdempotencyKey, useRefreshFinance, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';

const TYPES: FinanceAccountInputType[] = ['wallet', 'bank', 'cash', 'other'];
const CURRENCIES: FinanceAccountInputCurrency[] = ['ILS', 'USD', 'JOD'];

export function CreateAccountDialog({ open, onOpenChange, t }: { open: boolean; onOpenChange: (o: boolean) => void; t: Tx }) {
  const [type, setType] = useState<FinanceAccountInputType>('wallet');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<FinanceAccountInputCurrency>('ILS');
  const [error, setError] = useState('');
  const refresh = useRefreshFinance();
  const idem = useIdempotencyKey();
  const mutation = useCreateFinanceAccount({ request: { headers: idem.headers } });

  useEffect(() => { if (open) { setType('wallet'); setName(''); setCurrency('ILS'); setError(''); idem.renew(); mutation.reset(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit() {
    const n = name.trim() || t(ACCOUNT_TYPE_LABEL[type]![0], ACCOUNT_TYPE_LABEL[type]![1]);
    if (mutation.isPending) return;
    if (n.length > 120) { setError(t('Name must be 120 characters or fewer.', 'يجب ألا يتجاوز الاسم 120 حرفاً.')); return; }
    setError('');
    mutation.mutate({ data: { type, name: n, currency } }, { onSuccess: () => { idem.renew(); void refresh(); onOpenChange(false); } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-create-account">
        <DialogHeader>
          <DialogTitle>{t('New account', 'حساب جديد')}</DialogTitle>
          <DialogDescription>{t('Accounts start at zero. Balances only change through recorded, simulated movements.', 'تبدأ الحسابات من صفر. تتغير الأرصدة فقط عبر حركات محاكاة مسجلة.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="type-label pb-1.5">{t('Type', 'النوع')}</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {TYPES.map((ty) => (
                <label key={ty} className={cn('type-label flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors', type === ty ? 'border-primary bg-primary-soft' : 'border-input hover:bg-muted')}>
                  <input type="radio" name="acct-type" value={ty} checked={type === ty} onChange={() => setType(ty)} className="accent-[hsl(var(--primary))]" data-testid={`radio-type-${ty}`} />
                  {t(ACCOUNT_TYPE_LABEL[ty]![0], ACCOUNT_TYPE_LABEL[ty]![1])}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="acct-name" label={t('Name', 'الاسم')} error={error} hint={t('Optional. Defaults to the type.', 'اختياري. الافتراضي هو النوع.')}>
            <input id="acct-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputClass} aria-invalid={!!error} data-testid="input-account-name" />
          </Field>
          <Field id="acct-currency" label={t('Currency', 'العملة')} hint={t('Currency cannot be changed later.', 'لا يمكن تغيير العملة لاحقاً.')}>
            <select id="acct-currency" value={currency} onChange={(e) => setCurrency(e.target.value as FinanceAccountInputCurrency)} className={inputClass} data-testid="select-account-currency">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {mutation.isError ? <Notice tone="error" title={t('Account not created', 'لم يُنشأ الحساب')} body={apiErrorText(mutation.error, t)} /> : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending} data-testid="button-create-account">
              {mutation.isPending ? <><Loader2 className="animate-spin" aria-hidden />{t('Creating…', 'جارٍ الإنشاء…')}</> : t('Create account', 'إنشاء الحساب')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
