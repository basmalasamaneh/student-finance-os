import { useState } from 'react';
import { Link } from 'wouter';
import { Check, MessageSquare, SlidersHorizontal, Wallet, X } from 'lucide-react';
import type { FamilyMoneyRequest, FamilyMoneyRequestStatus, FinanceAccount } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel } from '@/components/states/state-panel';
import { HighValueConfirm } from '@/components/money/high-value-confirm';
import { Field, ReviewRow, SimulatedNote, inputClass } from '@/components/money/fields';
import { useDeviceSecurity } from '@/features/security/device-security';
import { accountName, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';
import { MessageSheet, RequestHistory, RequestListFrame, RequestRow, RequestSummary, type ListState } from './request-shared';
import { REQUEST_STATUSES, isLive, statusLabel } from './request-view-model';

export interface ParentRequestFilters { status: FamilyMoneyRequestStatus | 'all'; childId: string | 'all' }

export function ParentRequestsView({ t, requests, state, filters, kids, childName, onFiltersChange }: {
  t: Tx; requests: FamilyMoneyRequest[]; state: ListState; filters: ParentRequestFilters;
  kids: { id: string; name: string }[]; childName: (studentId: string) => string; onFiltersChange: (f: ParentRequestFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const active = (filters.status !== 'all' ? 1 : 0) + (filters.childId !== 'all' ? 1 : 0);
  return (
    <div className="flex flex-col gap-4" data-testid="section-parent-requests">
      <Button variant="outline" className="min-h-11 self-start" onClick={() => { setDraft(filters); setOpen(true); }} data-testid="button-open-request-filters">
        <SlidersHorizontal aria-hidden />{t('Filter', 'تصفية')}{active ? ` · ${active}` : ''}
      </Button>
      <RequestListFrame t={t} state={state} count={requests.length}
        empty={active
          ? { title: t('Nothing matches these filters', 'لا شيء يطابق هذه التصفية'), body: t('Try another status or child.', 'جرّب حالة أو ابناً آخر.'),
              action: <Button variant="outline" className="min-h-11" onClick={() => onFiltersChange({ status: 'all', childId: 'all' })} data-testid="button-clear-request-filters">{t('Clear filters', 'مسح التصفية')}</Button> }
          : { title: t('No requests from your children', 'لا توجد طلبات من أبنائك'), body: t('Requests appear here only when a child turns on “Requests” for you.', 'تظهر الطلبات هنا فقط عندما يفعّل ابنك «الطلبات» لك.') }}>
        {requests.map((r) => <RequestRow key={r.id} request={r} t={t} href={`/parent/requests/${r.id}`} counterpartName={childName(r.studentId)} />)}
      </RequestListFrame>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-sheet safe-bottom">
          <SheetHeader><SheetTitle>{t('Filter requests', 'تصفية الطلبات')}</SheetTitle><SheetDescription>{t('By status and child.', 'حسب الحالة والابن.')}</SheetDescription></SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <Field id="pr-status" label={t('Status', 'الحالة')}>
              <select id="pr-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ParentRequestFilters['status'] })} className={cn(inputClass, 'appearance-auto')} data-testid="select-filter-status">
                <option value="all">{t('All statuses', 'كل الحالات')}</option>
                {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, t)}</option>)}
              </select>
            </Field>
            <Field id="pr-child" label={t('Child', 'الابن')}>
              <select id="pr-child" value={draft.childId} onChange={(e) => setDraft({ ...draft, childId: e.target.value })} className={cn(inputClass, 'appearance-auto')} data-testid="select-filter-child">
                <option value="all">{t('All children', 'كل الأبناء')}</option>
                {kids.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Button className="min-h-11" onClick={() => { onFiltersChange(draft); setOpen(false); }} data-testid="button-apply-request-filters">{t('Show results', 'عرض النتائج')}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export interface ReviewAction<A extends unknown[]> { pending?: boolean; error?: string; run: (...a: A) => void }

export function ParentRequestReview({ t, request, child, payFromAccounts, walletLoading, approve, decline, askDetails }: {
  t: Tx; request: FamilyMoneyRequest; child: string;
  /** Parent's own wallet accounts already filtered to the request currency. */
  payFromAccounts: FinanceAccount[]; walletLoading: boolean;
  approve: ReviewAction<[accountId: string]> & { open: boolean; setOpen: (o: boolean) => void };
  decline: ReviewAction<[]> & { open: boolean; setOpen: (o: boolean) => void };
  askDetails: ReviewAction<[message: string]> & { open: boolean; setOpen: (o: boolean) => void };
}) {
  const { confirmationThreshold, hideBalances } = useDeviceSecurity();
  const [picked, setPicked] = useState('');
  const accountId = payFromAccounts.length === 1 ? payFromAccounts[0].id : picked;
  const from = payFromAccounts.find((a) => a.id === accountId);
  // Device threshold is ILS-only; any other currency always uses the enhanced confirmation.
  const enhanced = request.amount.currency !== 'ILS' || request.amount.minor > confirmationThreshold.minor;
  const live = isLive(request);
  return (
    <div className="flex flex-col gap-6" data-testid="review-family-request">
      <RequestSummary request={request} t={t} counterpartLabel={t('From', 'من')} counterpartName={child} />
      {live ? (
        walletLoading ? <div className="skeleton-shimmer h-24 rounded-card" aria-label={t('Loading your wallet', 'جارٍ تحميل محفظتك')} role="status" />
        : payFromAccounts.length === 0 ? (
          <div className="flex flex-col gap-4">
            <StatePanel tone="permission" icon={<Wallet className="size-5" />}
              title={t(`No ${request.amount.currency} wallet account to pay from`, `لا يوجد حساب محفظة بعملة ${request.amount.currency} للدفع منه`)}
              body={t('Approving never creates a wallet for you. Add or fund one on Home, then come back.', 'الموافقة لا تنشئ محفظة لك. أضف حساباً أو موّله من الرئيسية ثم عد.')}
              action={<Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-border px-4 type-label hover-elevate" data-testid="link-manage-wallet">{t('Manage wallet', 'إدارة المحفظة')}</Link>} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" className="min-h-11" onClick={() => askDetails.setOpen(true)} data-testid="button-ask-details"><MessageSquare aria-hidden />{t('Ask for details', 'طلب تفاصيل')}</Button>
              <Button variant="outline" className="min-h-11" onClick={() => decline.setOpen(true)} data-testid="button-decline-request"><X aria-hidden />{t('Decline', 'رفض')}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field id="pr-from" label={t('Pay from', 'الدفع من')} hint={t(`Only your own ${request.amount.currency} accounts are listed.`, `تظهر حساباتك بعملة ${request.amount.currency} فقط.`)}>
              <select id="pr-from" value={accountId} onChange={(e) => setPicked(e.target.value)} className={cn(inputClass, 'appearance-auto')} data-testid="select-pay-from">
                {payFromAccounts.length > 1 ? <option value="">{t('Choose an account', 'اختر حساباً')}</option> : null}
                {payFromAccounts.map((a) => <option key={a.id} value={a.id}>{accountName(a, t)} · {a.currency}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button className="btn-gradient min-h-11" disabled={!accountId} onClick={() => approve.setOpen(true)} data-testid="button-approve-request"><Check aria-hidden />{t('Approve', 'موافقة')}</Button>
              <Button variant="outline" className="min-h-11" onClick={() => askDetails.setOpen(true)} data-testid="button-ask-details"><MessageSquare aria-hidden />{t('Ask for details', 'طلب تفاصيل')}</Button>
              <Button variant="outline" className="min-h-11" onClick={() => decline.setOpen(true)} data-testid="button-decline-request"><X aria-hidden />{t('Decline', 'رفض')}</Button>
            </div>
          </div>
        )
      ) : null}
      <RequestHistory entries={request.history} names={{ student: child, parent: t('You', 'أنت') }} t={t} />

      <Sheet open={approve.open} onOpenChange={(o) => { if (!approve.pending) approve.setOpen(o); }}>
        <SheetContent side="bottom" className="rounded-sheet safe-bottom" data-parent-confidential-portal>
          <SheetHeader><SheetTitle>{t('Review payment', 'مراجعة الدفع')}</SheetTitle><SheetDescription>{t('Exact amount, same currency, no fee.', 'المبلغ الدقيق، نفس العملة، بدون رسوم.')}</SheetDescription></SheetHeader>
          <div className="flex flex-col gap-3 p-4">
            <ReviewRow label={t('Amount', 'المبلغ')} testId="review-amount"><MoneyDisplay value={request.amount} size="sm" /></ReviewRow>
            <ReviewRow label={t('From', 'من')}>{from ? <>{accountName(from, t)} · <MoneyDisplay value={from.balance} size="sm" tone="muted" hidden={hideBalances} hiddenLabel={t('Balance hidden', 'الرصيد مخفي')} /></> : null}</ReviewRow>
            <ReviewRow label={t('To', 'إلى')}>{child}</ReviewRow>
            <ReviewRow label={t('Fee', 'الرسوم')}>{t('None', 'لا يوجد')}</ReviewRow>
            <SimulatedNote t={t} />
            {approve.error ? <p role="alert" className="type-label text-destructive" data-testid="text-approve-error">{approve.error}</p> : null}
            {enhanced
              ? <HighValueConfirm onConfirm={() => from && approve.run(from.id)} disabled={!from} pending={approve.pending} threshold={confirmationThreshold} t={t} testId="button-confirm-approve" />
              : <Button className="btn-gradient min-h-11" disabled={approve.pending || !from} aria-busy={approve.pending} onClick={() => from && approve.run(from.id)} data-testid="button-confirm-approve">{t('Approve and pay', 'موافقة ودفع')}</Button>}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={decline.open} onOpenChange={(o) => { if (!decline.pending) decline.setOpen(o); }}>
        <AlertDialogContent data-parent-confidential-portal>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Decline this request?', 'رفض هذا الطلب؟')}</AlertDialogTitle>
            <AlertDialogDescription>{decline.error ?? t('No money moves. Your child sees that it was declined.', 'لن تتحرك أي أموال. سيرى ابنك أنه رُفض.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={decline.pending}>{t('Back', 'رجوع')}</AlertDialogCancel>
            <Button variant="destructive" className="min-h-11" disabled={decline.pending} aria-busy={decline.pending} onClick={() => decline.run()} data-testid="button-confirm-decline">{t('Decline', 'رفض')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MessageSheet open={askDetails.open} onOpenChange={askDetails.setOpen} t={t} testId="ask-details" pending={askDetails.pending} error={askDetails.error}
        title={t('Ask for more details', 'طلب تفاصيل إضافية')} description={t('The request stays open until they reply.', 'يبقى الطلب مفتوحاً حتى يرد.')}
        submitLabel={t('Send question', 'إرسال السؤال')} onSubmit={(m) => askDetails.run(m)} />
    </div>
  );
}
