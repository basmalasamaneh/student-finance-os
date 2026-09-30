import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDecideMoneyRequest, type FinanceAccount, type MoneyRequest, type MoneyRequestDecisionAction } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { Notice } from '@/components/states/state-panel';
import { ReviewRow, SimulatedNote } from './fields';
import { useI18n } from '@/features/i18n/i18n-provider';
import { accountName, apiErrorText, useIdempotencyKey, useRefreshFinance, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { en: string; ar: string; cls: string }> = {
  pending: { en: 'Pending', ar: 'معلّق', cls: 'bg-warning-soft text-warning' },
  fulfilled: { en: 'Paid', ar: 'مدفوع', cls: 'bg-success-soft text-success' },
  declined: { en: 'Declined', ar: 'مرفوض', cls: 'bg-destructive-soft text-destructive' },
  cancelled: { en: 'Cancelled', ar: 'ملغى', cls: 'bg-muted text-muted-foreground' },
};

type Pending = { request: MoneyRequest; action: MoneyRequestDecisionAction } | null;

export function RequestsList({ requests, accounts, userId, t }: { requests: MoneyRequest[]; accounts: FinanceAccount[]; userId: string; t: Tx }) {
  const { locale } = useI18n();
  const [pending, setPending] = useState<Pending>(null);
  return (
    <>
      <ul className="divide-y divide-divider border-y border-divider" data-testid="list-requests">
        {requests.map((r) => {
          const incoming = r.payerId === userId;
          const s = STATUS[r.status] ?? STATUS.pending!;
          return (
            <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid={`row-request-${r.id}`}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="type-label">{incoming ? t('Asked of you', 'مطلوب منك') : t('You requested', 'طلبتَ')}{r.note ? ` · ${r.note}` : ''}</span>
                <span className="type-caption text-muted-foreground"><bdi>{new Date(r.createdAt).toLocaleDateString(locale, { dateStyle: 'medium' })}</bdi></span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MoneyDisplay value={r.amount} size="sm" />
                <span className={cn('type-caption rounded-full px-2 py-0.5 font-medium', s.cls)} data-testid={`status-request-${r.id}`}>{t(s.en, s.ar)}</span>
                {r.status === 'pending' && incoming && <>
                  <Button size="sm" onClick={() => setPending({ request: r, action: 'fulfill' })} data-testid={`button-fulfill-${r.id}`}>{t('Pay', 'ادفع')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setPending({ request: r, action: 'decline' })} data-testid={`button-decline-${r.id}`}>{t('Decline', 'رفض')}</Button>
                </>}
                {r.status === 'pending' && !incoming && <Button size="sm" variant="outline" onClick={() => setPending({ request: r, action: 'cancel' })} data-testid={`button-cancel-request-${r.id}`}>{t('Cancel', 'إلغاء')}</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <DecisionDialog pending={pending} onClose={() => setPending(null)} accounts={accounts} t={t} />
    </>
  );
}

function DecisionDialog({ pending, onClose, accounts, t }: { pending: Pending; onClose: () => void; accounts: FinanceAccount[]; t: Tx }) {
  const idem = useIdempotencyKey();
  const refresh = useRefreshFinance();
  const mutation = useDecideMoneyRequest({ request: { headers: idem.headers } });
  const r = pending?.request;
  const action = pending?.action;
  const payerAccount = r ? accounts.find((a) => a.id === r.payerAccountId) : undefined;
  const insufficient = action === 'fulfill' && payerAccount && r && payerAccount.balance.minor < r.amount.minor;
  const titles: Record<MoneyRequestDecisionAction, [string, string]> = {
    fulfill: ['Pay this request?', 'دفع هذا الطلب؟'], decline: ['Decline this request?', 'رفض هذا الطلب؟'], cancel: ['Cancel your request?', 'إلغاء طلبك؟'],
  };
  const close = () => { if (!mutation.isPending) { mutation.reset(); idem.renew(); onClose(); } };
  return (
    <Dialog open={!!pending} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md" data-testid="dialog-decision">
        {r && action ? <>
          <DialogHeader>
            <DialogTitle>{t(titles[action][0], titles[action][1])}</DialogTitle>
            <DialogDescription>{action === 'fulfill' ? t('This debits your account and credits the requester. It cannot be undone.', 'سيُخصم من حسابك ويُضاف للطالب. لا يمكن التراجع.') : t('The request closes and no money moves.', 'سيُغلق الطلب ولن يتحرك أي مال.')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-1"><MoneyDisplay value={r.amount} size="xl" /></div>
          <dl className="divide-y divide-divider border-y border-divider">
            {action === 'fulfill' ? <ReviewRow label={t('Paid from', 'الدفع من')}>{payerAccount ? accountName(payerAccount, t) : r.payerAccountId}</ReviewRow> : null}
            {action === 'fulfill' && payerAccount ? <ReviewRow label={t('Balance now', 'الرصيد الآن')}><MoneyDisplay value={payerAccount.balance} size="sm" /></ReviewRow> : null}
            {r.note ? <ReviewRow label={t('Note', 'ملاحظة')}>{r.note}</ReviewRow> : null}
          </dl>
          {insufficient ? <Notice tone="error" title={t('Insufficient balance', 'رصيد غير كافٍ')} body={t('Add money to this account before paying.', 'أضف مالاً لهذا الحساب قبل الدفع.')} /> : null}
          {mutation.isError ? <Notice tone="error" title={t('Not completed', 'لم يكتمل')} body={apiErrorText(mutation.error, t)} /> : null}
          {action === 'fulfill' ? <SimulatedNote t={t} /> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={mutation.isPending}>{t('Back', 'رجوع')}</Button>
            <Button variant={action === 'fulfill' ? 'default' : 'destructive'} disabled={mutation.isPending || !!insufficient} aria-busy={mutation.isPending} data-testid="button-confirm-decision"
              onClick={() => mutation.mutate({ id: r.id, data: { action } }, { onSuccess: () => { void refresh(); idem.renew(); mutation.reset(); onClose(); } })}>
              {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {action === 'fulfill' ? t('Confirm payment', 'تأكيد الدفع') : action === 'decline' ? t('Decline', 'رفض') : t('Cancel request', 'إلغاء الطلب')}
            </Button>
          </DialogFooter>
        </> : null}
      </DialogContent>
    </Dialog>
  );
}
