import { useEffect, useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import type { FamilyLink, FamilyMoneyRequest, FinanceAccount } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StatePanel } from '@/components/states/state-panel';
import { AmountInput, Field, SimulatedNote, inputClass } from '@/components/money/fields';
import { accountName, amountErrorText, parseAmountInput, type Tx } from '@/features/money/money-model';
import { todayUtc } from '@/features/family/family-view';
import type { Currency, Money } from '@/lib/money';
import { cn } from '@/lib/utils';
import { MessageSheet, RequestHistory, RequestListFrame, RequestRow, RequestSummary, type ListState } from './request-shared';
import { isLive } from './request-view-model';

export const guardianName = (l: FamilyLink | undefined, t: Tx) => l?.parentName || t('Guardian', 'وليّ الأمر');

export function StudentFamilyRequestsView({ t, requests, links, state, canRequest, onNew }: {
  t: Tx; requests: FamilyMoneyRequest[]; links: FamilyLink[]; state: ListState; canRequest: boolean; onNew: () => void;
}) {
  if (!state.loading && !state.error && !canRequest && requests.length === 0) {
    return <StatePanel tone="permission" icon={<Users className="size-5" />}
      title={t('No guardian can receive requests yet', 'لا يوجد وليّ أمر يمكنه استلام الطلبات بعد')}
      body={t('Turn on “Requests” for a linked guardian on your Family page first.', 'فعّل «الطلبات» لوليّ أمر مرتبط من صفحة العائلة أولاً.')} />;
  }
  return (
    <div className="flex flex-col gap-4" data-testid="section-student-family-requests">
      {canRequest ? <Button onClick={onNew} className="btn-gradient min-h-11 self-start" data-testid="button-new-family-request"><Plus aria-hidden />{t('Ask a guardian', 'اطلب من وليّ أمر')}</Button> : null}
      <RequestListFrame t={t} state={state} count={requests.length}
        empty={{ title: t('No family requests yet', 'لا توجد طلبات عائلية بعد'), body: t('When you ask a guardian for money, it shows up here with every reply.', 'عندما تطلب مالاً من وليّ أمر سيظهر الطلب هنا مع كل الردود.') }}>
        {requests.map((r) => <RequestRow key={r.id} request={r} t={t} href={`/family/requests/${r.id}`}
          counterpartName={guardianName(links.find((l) => l.id === r.familyLinkId), t)} />)}
      </RequestListFrame>
    </div>
  );
}

export interface NewFamilyRequestBody { familyLinkId: string; receivingAccountId: string; amount: Money; reason: string; note: string; date: string }

export function NewFamilyRequestSheet({ t, open, onOpenChange, guardians, accounts, pending, error, onSubmit }: {
  t: Tx; open: boolean; onOpenChange: (o: boolean) => void; guardians: FamilyLink[]; accounts: FinanceAccount[];
  pending?: boolean; error?: string; onSubmit: (v: NewFamilyRequestBody) => void;
}) {
  const blank = { link: '', account: '', amount: '', reason: '', note: '', date: todayUtc() };
  const [v, setV] = useState(blank);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setV({ ...blank, link: guardians.length === 1 ? guardians[0].id : '' }); setTouched(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof v) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const account = accounts.find((a) => a.id === v.account);
  const currency = account?.currency as Currency | undefined;
  const parsed = currency ? parseAmountInput(v.amount, currency) : null;
  const errs = {
    link: !v.link ? t('Choose a guardian.', 'اختر وليّ أمر.') : undefined,
    account: !v.account ? t('Choose an account.', 'اختر حساباً.') : undefined,
    amount: currency && parsed && !parsed.ok ? amountErrorText(parsed.reason, currency, t) : undefined,
    reason: !v.reason.trim() ? t('Add a short reason.', 'أضف سبباً قصيراً.') : undefined,
    date: !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ? t('Choose a date.', 'اختر تاريخاً.') : undefined,
  };
  const valid = !Object.values(errs).some(Boolean) && parsed?.ok;
  const show = (e?: string) => (touched ? e : undefined);
  function submit() {
    setTouched(true);
    if (!valid || !parsed?.ok || pending) return;
    onSubmit({ familyLinkId: v.link, receivingAccountId: v.account, amount: parsed.value, reason: v.reason.trim(), note: v.note.trim(), date: v.date });
  }
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-sheet safe-bottom">
        <SheetHeader>
          <SheetTitle>{t('Ask a guardian for money', 'اطلب مالاً من وليّ أمر')}</SheetTitle>
          <SheetDescription>{t('They review it and can pay from their own wallet in the same currency.', 'يراجع الطلب ويمكنه الدفع من محفظته بنفس العملة.')}</SheetDescription>
        </SheetHeader>
        <form className="flex flex-col gap-4 overflow-y-auto p-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field id="fr-guardian" label={t('Guardian', 'وليّ الأمر')} error={show(errs.link)}>
            <select id="fr-guardian" value={v.link} onChange={(e) => set('link')(e.target.value)} className={cn(inputClass, 'appearance-auto')} data-testid="select-request-guardian">
              <option value="">{t('Choose a guardian', 'اختر وليّ أمر')}</option>
              {guardians.map((g) => <option key={g.id} value={g.id}>{guardianName(g, t)}</option>)}
            </select>
          </Field>
          <Field id="fr-account" label={t('Receive into', 'الاستلام في')} hint={t('The request uses this account’s currency.', 'يستخدم الطلب عملة هذا الحساب.')} error={show(errs.account)}>
            <select id="fr-account" value={v.account} onChange={(e) => set('account')(e.target.value)} className={cn(inputClass, 'appearance-auto')} data-testid="select-request-account">
              <option value="">{t('Choose an account', 'اختر حساباً')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a, t)} · {a.currency}</option>)}
            </select>
          </Field>
          <Field id="fr-amount" label={t('Amount', 'المبلغ')} error={show(errs.amount)}>
            <AmountInput id="fr-amount" value={v.amount} onChange={set('amount')} currency={currency} error={show(errs.amount)} />
          </Field>
          <Field id="fr-date" label={t('Date', 'التاريخ')} hint={t('What the money is for — not a payment schedule.', 'تاريخ الحاجة — ليس موعد دفع مجدولاً.')} error={show(errs.date)}>
            <input id="fr-date" type="date" required value={v.date} onChange={(e) => set('date')(e.target.value)} className={inputClass} data-testid="input-request-date" />
          </Field>
          <Field id="fr-reason" label={t('Reason', 'السبب')} error={show(errs.reason)}>
            <input id="fr-reason" value={v.reason} maxLength={120} onChange={(e) => set('reason')(e.target.value)} className={inputClass} data-testid="input-request-reason" />
          </Field>
          <Field id="fr-note" label={t('Note (optional)', 'ملاحظة (اختياري)')}>
            <textarea id="fr-note" value={v.note} maxLength={500} rows={3} onChange={(e) => set('note')(e.target.value)} className={cn(inputClass, 'py-3')} data-testid="input-request-note" />
          </Field>
          <SimulatedNote t={t} />
          {error ? <p role="alert" className="type-label text-destructive" data-testid="text-request-error">{error}</p> : null}
          <Button type="submit" className="btn-gradient min-h-11" disabled={pending} aria-busy={pending} data-testid="button-submit-family-request">
            {pending ? t('Sending…', 'جارٍ الإرسال…') : t('Send request', 'إرسال الطلب')}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function StudentFamilyRequestDetail({ t, request, guardian, receivingAccountLabel, studentLabel, reply, cancel }: {
  t: Tx; request: FamilyMoneyRequest; guardian: string; receivingAccountLabel?: string; studentLabel: string;
  reply: { open: boolean; setOpen: (o: boolean) => void; pending?: boolean; error?: string; onSubmit: (message: string) => void };
  cancel: { open: boolean; setOpen: (o: boolean) => void; pending?: boolean; error?: string; onConfirm: () => void };
}) {
  const live = isLive(request);
  return (
    <div className="flex flex-col gap-6" data-testid="detail-family-request">
      <RequestSummary request={request} t={t} counterpartLabel={t('Guardian', 'وليّ الأمر')} counterpartName={guardian} receivingAccountLabel={receivingAccountLabel} />
      {live ? (
        <div className="flex flex-wrap gap-3">
          {request.status === 'details_requested' ? <Button onClick={() => reply.setOpen(true)} className="btn-gradient min-h-11" data-testid="button-reply-request">{t('Reply with details', 'الرد بالتفاصيل')}</Button> : null}
          <Button variant="outline" onClick={() => cancel.setOpen(true)} className="min-h-11" data-testid="button-cancel-request"><X aria-hidden />{t('Cancel request', 'إلغاء الطلب')}</Button>
        </div>
      ) : null}
      <RequestHistory entries={request.history} names={{ student: studentLabel, parent: guardian }} t={t} />
      <MessageSheet open={reply.open} onOpenChange={reply.setOpen} t={t} testId="reply-request" pending={reply.pending} error={reply.error}
        title={t('Reply to your guardian', 'الرد على وليّ أمرك')} description={t('Add the details they asked for.', 'أضف التفاصيل المطلوبة.')}
        submitLabel={t('Send reply', 'إرسال الرد')} onSubmit={reply.onSubmit} />
      <AlertDialog open={cancel.open} onOpenChange={(o) => { if (!cancel.pending) cancel.setOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Cancel this request?', 'إلغاء هذا الطلب؟')}</AlertDialogTitle>
            <AlertDialogDescription>{cancel.error ?? t('Your guardian will no longer be able to approve it. Messages are kept.', 'لن يتمكن وليّ أمرك من الموافقة عليه. تبقى الرسائل محفوظة.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={cancel.pending}>{t('Keep request', 'إبقاء الطلب')}</AlertDialogCancel>
            <Button variant="destructive" className="min-h-11" disabled={cancel.pending} aria-busy={cancel.pending} onClick={cancel.onConfirm} data-testid="button-confirm-cancel-request">{t('Cancel request', 'إلغاء الطلب')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
