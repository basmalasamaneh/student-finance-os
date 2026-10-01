import { useLayoutEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import {
  getGetNotificationUnreadCountQueryKey, getListNotificationsQueryKey, useGetNotificationUnreadCount, useListNotifications,
  useMarkAllNotificationsRead, useMarkNotificationRead, type InAppNotification,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MoneyDisplay } from '@/components/finance/money-display';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useDeviceSecurity } from '@/features/security/device-security';
import { concealAndRefresh, useParentFreshnessGate } from '@/features/family/parent-freshness';
import { apiErrorText, useTx, type Tx } from '@/features/money/money-model';
import { NOTIFICATION_REFETCH, useRefreshNotifications } from '@/features/requests/use-family-requests';
import { formatDate } from '@/lib/money';
import { cn } from '@/lib/utils';
import { notificationText, safeHref } from './request-view-model';

/** Shell inbox for students and parents (admins have no inbox endpoint access). */
export function NotificationCenter({ className }: { className?: string }) {
  const { role } = useAccount();
  if (role === 'parent') return <ParentCenter className={className} />;
  if (role === 'student') return <Center concealed={false} focusRefetch className={className} />;
  return null;
}

/** Parent: the bell lives outside ParentOnly, so it mounts the confidential freshness gate itself. */
function ParentCenter({ className }: { className?: string }) {
  const concealed = useParentFreshnessGate();
  usePermissionChangeGate();
  return <Center concealed={concealed} focusRefetch={false} className={className} />;
}

/** Latest permission_changed id already gated, per account (module scope: survives remounts, shared by both bells). */
const seenPermissionEvent = new Map<string, string>();

/**
 * Sharing changes arrive only as a generic `permission_changed` notification. The unread count carries no type,
 * so the inbox list is polled (same 20s bound, shared cache with the sheet) and a NEW latest permission event —
 * including the first one seen after bootstrap — runs the freshness gate once. useLayoutEffect sets the
 * conceal attribute synchronously in the same commit, before paint. The gate's own /api/notifications refetch
 * returns the same latest id, so it never re-triggers (no loop).
 */
function usePermissionChangeGate() {
  const qc = useQueryClient();
  const { id: accountId } = useAccount();
  const list = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), ...NOTIFICATION_REFETCH, refetchOnWindowFocus: false } });
  const latest = list.data?.items
    .filter((n) => n.type === 'permission_changed')
    .reduce<InAppNotification | undefined>((a, n) => (!a || n.createdAt > a.createdAt ? n : a), undefined)?.id;
  useLayoutEffect(() => {
    if (!latest || seenPermissionEvent.get(accountId) === latest) return;
    seenPermissionEvent.set(accountId, latest);
    void concealAndRefresh(qc);
  }, [latest, accountId, qc]);
}

function Center({ concealed, focusRefetch, className }: { concealed: boolean; focusRefetch: boolean; className?: string }) {
  const t = useTx();
  const [open, setOpen] = useState(false);
  const count = useGetNotificationUnreadCount({ query: { queryKey: getGetNotificationUnreadCountQueryKey(), ...NOTIFICATION_REFETCH, refetchOnWindowFocus: focusRefetch } });
  // Stale/unknown count is never shown: hidden while pending, errored, or concealed during return-revalidation.
  const unread = !concealed && count.isSuccess && !count.isRefetchError ? count.data.unreadCount : undefined;
  return (
    <>
      <NotificationBell t={t} unread={unread} onOpen={() => setOpen(true)} className={className} />
      {open ? <InboxSheet t={t} open={open} onOpenChange={setOpen} concealed={concealed} focusRefetch={focusRefetch} /> : null}
    </>
  );
}

export function NotificationBell({ t, unread, onOpen, className }: { t: Tx; unread?: number; onOpen: () => void; className?: string }) {
  const has = typeof unread === 'number' && unread > 0;
  const label = has ? t(`Notifications, ${unread} unread`, `الإشعارات، ${unread} غير مقروءة`) : t('Notifications', 'الإشعارات');
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onOpen} aria-label={label} className={cn('relative size-11 text-muted-foreground hover:text-foreground', className)} data-testid="button-notifications">
      <Bell aria-hidden />
      {has ? <span aria-hidden className="tabular absolute end-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground" data-testid="badge-unread-count">{unread > 99 ? '99+' : unread}</span> : null}
    </Button>
  );
}

function InboxSheet({ t, open, onOpenChange, concealed, focusRefetch }: { t: Tx; open: boolean; onOpenChange: (o: boolean) => void; concealed: boolean; focusRefetch: boolean }) {
  const { locale } = useI18n();
  const { hideBalances } = useDeviceSecurity();
  const refresh = useRefreshNotifications();
  const q = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), ...NOTIFICATION_REFETCH, refetchOnWindowFocus: focusRefetch } });
  const markOne = useMarkNotificationRead({ mutation: { onSettled: () => void refresh() } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSettled: () => void refresh() } });
  const items = q.data?.items ?? [];
  const unread = items.some((n) => !n.readAt);
  const read = (n: InAppNotification) => { if (!n.readAt && !markOne.isPending) markOne.mutate({ id: n.id }); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-sheet safe-bottom md:mx-auto md:max-w-lg" data-parent-confidential-portal>
        <SheetHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div><SheetTitle>{t('Notifications', 'الإشعارات')}</SheetTitle><SheetDescription>{t('In-app only. Only what you’re allowed to see.', 'داخل التطبيق فقط. فقط ما يُسمح لك برؤيته.')}</SheetDescription></div>
          {unread && !concealed && q.isSuccess ? <Button variant="ghost" className="min-h-11" disabled={markAll.isPending} aria-busy={markAll.isPending} onClick={() => markAll.mutate()} data-testid="button-mark-all-read"><CheckCheck aria-hidden />{t('Mark all read', 'تعليم الكل كمقروء')}</Button> : null}
        </SheetHeader>
        <div className="max-h-[70dvh] overflow-y-auto px-4 pb-4">
          {q.isPending || concealed ? <SkeletonRows rows={4} label={t('Loading notifications', 'جارٍ تحميل الإشعارات')} />
            : q.isError ? <StatePanel tone="error" title={t('Notifications could not load', 'تعذّر تحميل الإشعارات')} body={apiErrorText(q.error, t)}
                action={<RetryButton label={t('Try again', 'حاول مجدداً')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
            : (
              <PullToRefresh onRefresh={() => q.refetch()} label={t('Refreshing notifications', 'جارٍ تحديث الإشعارات')}>
                {(markOne.isError || markAll.isError) ? <p role="alert" className="type-caption py-2 text-destructive">{apiErrorText(markOne.error ?? markAll.error, t)}</p> : null}
                {items.length === 0
                  ? <StatePanel tone="empty" icon={<BellOff className="size-5" />} title={t('You’re all caught up', 'لا جديد')} body={t('Request updates and allowance news will appear here.', 'ستظهر هنا تحديثات الطلبات وأخبار المصروف.')} />
                  : <ul className="flex flex-col divide-y divide-divider" data-testid="list-notifications">
                      {items.map((n) => {
                        const href = safeHref(n.href);
                        const body = (
                          <>
                            <span aria-hidden className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className={cn('type-label', n.readAt && 'font-normal text-muted-foreground')}>{notificationText(n, t)}</span>
                              <span className="type-caption text-muted-foreground">{formatDate(new Date(n.createdAt), locale)}{n.readAt ? '' : ` · ${t('Unread', 'غير مقروء')}`}</span>
                            </span>
                            {n.amount ? <MoneyDisplay value={n.amount} size="sm" hidden={hideBalances} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} /> : null}
                          </>
                        );
                        const cls = 'hover-elevate flex min-h-[56px] w-full items-start gap-3 rounded-[14px] px-2 py-3 text-start disabled:opacity-100';
                        return (
                          <li key={n.id}>
                            {href
                              ? <Link href={href} className={cls} onClick={() => { read(n); onOpenChange(false); }} data-testid={`link-notification-${n.id}`}>{body}</Link>
                              : <button type="button" className={cls} disabled={!!n.readAt} onClick={() => read(n)} data-testid={`button-notification-${n.id}`}>{body}</button>}
                          </li>
                        );
                      })}
                    </ul>}
              </PullToRefresh>
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
