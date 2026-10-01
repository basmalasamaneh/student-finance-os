import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Inbox, MessageSquare } from 'lucide-react';
import type { FamilyMoneyRequest, FamilyRequestMessage } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { Field, inputClass } from '@/components/money/fields';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useDeviceSecurity } from '@/features/security/device-security';
import { formatDate } from '@/lib/money';
import { day } from '@/features/family/family-view';
import type { Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';
import { STATUS_META, statusLabel } from './request-view-model';

export interface ListState { loading: boolean; error?: string; retrying?: boolean; onRetry: () => void; onRefresh: () => Promise<unknown> }

export function RequestListFrame({ t, state, empty, count, children }: {
  t: Tx; state: ListState; empty: { title: string; body: string; action?: ReactNode }; count: number; children: ReactNode;
}) {
  if (state.loading) return <SkeletonRows rows={4} label={t('Loading requests', 'جارٍ تحميل الطلبات')} />;
  if (state.error) return <StatePanel tone="error" title={t('Requests could not load', 'تعذّر تحميل الطلبات')} body={state.error}
    action={<RetryButton label={t('Try again', 'حاول مجدداً')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={state.retrying} onClick={state.onRetry} />} />;
  return (
    <PullToRefresh onRefresh={state.onRefresh} label={t('Refreshing requests', 'جارٍ تحديث الطلبات')}>
      {count === 0
        ? <StatePanel tone="empty" icon={<Inbox className="size-5" />} title={empty.title} body={empty.body} action={empty.action} />
        : <ul className="stagger flex flex-col divide-y divide-divider" data-testid="list-family-requests">{children}</ul>}
    </PullToRefresh>
  );
}

export function RequestRow({ request, counterpartName, href, t }: { request: FamilyMoneyRequest; counterpartName: string; href: string; t: Tx }) {
  const { locale } = useI18n();
  const { hideBalances } = useDeviceSecurity();
  return (
    <li>
      <Link href={href} data-testid={`row-family-request-${request.id}`}
        className="hover-elevate flex min-h-[64px] w-full items-center gap-3 rounded-[14px] px-2 py-3 text-start">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="type-label truncate">{request.reason}</span>
          <span className="type-caption text-muted-foreground">{counterpartName} · {formatDate(day(request.date), locale)}</span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <MoneyDisplay value={request.amount} size="sm" hidden={hideBalances} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} />
          <StatusBadge tone={STATUS_META[request.status].tone} label={statusLabel(request.status, t)} />
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export function RequestSummary({ request, t, counterpartLabel, counterpartName, receivingAccountLabel }: {
  request: FamilyMoneyRequest; t: Tx; counterpartLabel: string; counterpartName: string; receivingAccountLabel?: string;
}) {
  const { locale } = useI18n();
  const { hideBalances } = useDeviceSecurity();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <MoneyDisplay value={request.amount} size="lg" testId="text-request-amount" hidden={hideBalances} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} />
        <StatusBadge tone={STATUS_META[request.status].tone} label={statusLabel(request.status, t)} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 type-label">
        <dt className="text-muted-foreground">{counterpartLabel}</dt><dd data-testid="text-request-counterpart">{counterpartName}</dd>
        <dt className="text-muted-foreground">{t('Reason', 'السبب')}</dt><dd className="break-words" data-testid="text-request-reason">{request.reason}</dd>
        {request.note ? <><dt className="text-muted-foreground">{t('Note', 'ملاحظة')}</dt><dd className="whitespace-pre-wrap break-words">{request.note}</dd></> : null}
        <dt className="text-muted-foreground">{t('For date', 'التاريخ')}</dt><dd>{formatDate(day(request.date), locale)}</dd>
        {receivingAccountLabel ? <><dt className="text-muted-foreground">{t('Paid into', 'يُدفع إلى')}</dt><dd>{receivingAccountLabel} · {request.amount.currency}</dd></> : null}
        <dt className="text-muted-foreground">{t('Sent', 'أُرسل')}</dt><dd>{formatDate(new Date(request.createdAt), locale)}</dd>
        {request.updatedAt !== request.createdAt ? <><dt className="text-muted-foreground">{t('Updated', 'آخر تحديث')}</dt><dd>{formatDate(new Date(request.updatedAt), locale)}</dd></> : null}
      </dl>
    </div>
  );
}

export function RequestHistory({ entries, names, t }: { entries: FamilyRequestMessage[]; names: { student: string; parent: string }; t: Tx }) {
  const { locale } = useI18n();
  return (
    <section aria-label={t('Messages', 'الرسائل')} className="flex flex-col gap-3">
      <h3 className="type-subtitle">{t('Messages', 'الرسائل')}</h3>
      {entries.length === 0 ? <p className="type-caption text-muted-foreground">{t('No messages yet.', 'لا رسائل بعد.')}</p> : (
        <ol className="relative flex flex-col gap-4 border-s border-divider ps-4" data-testid="list-request-history">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className={cn('absolute -start-[21px] top-1.5 size-2.5 rounded-full', e.role === 'parent' ? 'bg-primary' : 'bg-muted-foreground')} />
              <p className="type-label">{names[e.role]}</p>
              <p className="type-body mt-1 whitespace-pre-wrap break-words rounded-[14px] bg-muted px-3 py-2">{e.message}</p>
              <p className="type-caption text-muted-foreground">{formatDate(new Date(e.createdAt), locale)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MessageSheet({ open, onOpenChange, title, description, submitLabel, pending, error, onSubmit, t, testId }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; submitLabel: string;
  pending?: boolean; error?: string; onSubmit: (message: string) => void; t: Tx; testId: string;
}) {
  const [message, setMessage] = useState('');
  const trimmed = message.trim();
  return (
    <Sheet open={open} onOpenChange={(o) => { if (pending) return; if (!o) setMessage(''); onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-sheet safe-bottom">
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
        <form className="flex flex-col gap-4 p-4" onSubmit={(e) => { e.preventDefault(); if (trimmed && !pending) onSubmit(trimmed); }}>
          <Field id={`${testId}-message`} label={t('Message', 'الرسالة')} error={error}>
            <textarea id={`${testId}-message`} value={message} maxLength={500} rows={4} onChange={(e) => setMessage(e.target.value)}
              className={cn(inputClass, 'py-3')} data-testid={`input-${testId}`} />
          </Field>
          <Button type="submit" className="min-h-11" disabled={!trimmed || pending} aria-busy={pending} data-testid={`button-submit-${testId}`}>
            <MessageSquare aria-hidden />{submitLabel}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function NotFoundRequest({ t, back }: { t: Tx; back: string }) {
  return <StatePanel tone="permission" title={t('This request isn’t available', 'هذا الطلب غير متاح')}
    body={t('It may have been removed, or sharing changed.', 'ربما أُزيل أو تغيّرت المشاركة.')}
    action={<Link href={back} className="inline-flex min-h-11 items-center rounded-[14px] border border-border px-4 type-label hover-elevate" data-testid="link-back-requests">{t('Back to requests', 'العودة إلى الطلبات')}</Link>} />;
}
