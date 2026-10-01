import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import {
  getGetParentDashboardQueryKey, getGetParentFamilyRequestQueryKey, getGetParentWalletQueryKey, getListParentFamilyRequestsQueryKey,
  useApproveFamilyRequest, useAskFamilyRequestDetails, useDeclineFamilyRequest, useGetParentDashboard, useGetParentFamilyRequest,
  useGetParentWallet, useListParentFamilyRequests,
} from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { ParentOnly } from '@/components/family/parent-only';
import { ParentRequestReview, ParentRequestsView, type ParentRequestFilters } from '@/components/requests/parent-family-requests';
import { NotFoundRequest } from '@/components/requests/request-shared';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, useTx } from '@/features/money/money-model';
import { FAMILY_REFETCH, isGone, useKeyRing } from '@/features/family/family-view';
import { retryUnlessGone, answered, useAfterRequestMutation, useDropRequestCache } from '@/features/requests/use-family-requests';

export default function ParentRequestsPage() {
  const t = useTx();
  return <ParentOnly t={t}><ListInner /></ParentOnly>;
}

function useChildNames() {
  const t = useTx();
  const dash = useGetParentDashboard({ query: { queryKey: getGetParentDashboardQueryKey(), ...FAMILY_REFETCH } });
  const kids = useMemo(() => (dash.data?.children ?? []).map((c) => ({ id: c.childId, name: c.name })), [dash.data]);
  const name = (id: string) => kids.find((k) => k.id === id)?.name ?? t('Your child', 'ابنك');
  return { dash, kids, name };
}

function ListInner() {
  const t = useTx();
  const q = useListParentFamilyRequests({ query: { queryKey: getListParentFamilyRequestsQueryKey(), ...FAMILY_REFETCH } });
  const { dash, kids, name } = useChildNames();
  const [filters, setFilters] = useState<ParentRequestFilters>({ status: 'all', childId: 'all' });
  const rows = (q.data ?? []).filter((r) => (filters.status === 'all' || r.status === filters.status) && (filters.childId === 'all' || r.studentId === filters.childId));
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Requests', 'الطلبات')}
        lede={t('Review what your children ask for. Payments are simulated and come from your own wallet.', 'راجع ما يطلبه أبناؤك. المدفوعات تجريبية ومن محفظتك.')} />
      <ParentRequestsView t={t} requests={rows} filters={filters} onFiltersChange={setFilters} kids={kids} childName={name}
        state={{ loading: q.isPending, error: q.isError ? apiErrorText(q.error, t) : undefined, retrying: q.isFetching,
          onRetry: () => void q.refetch(), onRefresh: () => Promise.all([q.refetch(), dash.refetch()]) }} />
    </Page>
  );
}

export function ParentRequestDetailPage() {
  const t = useTx();
  return <ParentOnly t={t}><DetailInner /></ParentOnly>;
}

function DetailInner() {
  const t = useTx();
  const id = useParams().id ?? '';
  const { toast } = useToast();
  const after = useAfterRequestMutation();
  const drop = useDropRequestCache();
  const ring = useKeyRing();
  const q = useGetParentFamilyRequest(id, { query: { queryKey: getGetParentFamilyRequestQueryKey(id), enabled: !!id, ...FAMILY_REFETCH, retry: retryUnlessGone } });
  const wallet = useGetParentWallet({ query: { queryKey: getGetParentWalletQueryKey(), ...FAMILY_REFETCH } });
  const { name } = useChildNames();
  const approve = useApproveFamilyRequest({ request: { headers: ring.headers } });
  const decline = useDeclineFamilyRequest({ request: { headers: ring.headers } });
  const ask = useAskFamilyRequestDetails({ request: { headers: ring.headers } });
  const [open, setOpen] = useState<'approve' | 'decline' | 'ask' | null>(null);
  const [errs, setErrs] = useState<{ approve?: string; decline?: string; ask?: string }>({});
  const gone = q.isError && isGone(q.error);
  useEffect(() => { if (gone) drop('/api/parent/requests', getGetParentFamilyRequestQueryKey(id)[0]); }, [gone, drop, id]);

  const request = q.data;
  const payFrom = useMemo(() => (wallet.data?.accounts ?? []).filter((a) => request && a.currency === request.amount.currency), [wallet.data, request]);

  const run = (kind: 'approve' | 'decline' | 'ask', fp: string, go: (cb: { onSuccess: () => void; onError: (e: unknown) => void }) => void, ok: string) => {
    ring.prime(fp); setErrs((s) => ({ ...s, [kind]: undefined }));
    go({
      onSuccess: () => { ring.done(fp); setOpen(null); void after(); toast({ title: ok }); },
      onError: (e) => { if (answered(e)) ring.done(fp); setErrs((s) => ({ ...s, [kind]: apiErrorText(e, t) })); void after(); },
    });
  };
  function onApprove(accountId: string) {
    // Explicit body: only an own wallet account whose currency matches the request.
    if (!request || !payFrom.some((a) => a.id === accountId)) return;
    run('approve', `approve:${id}:${accountId}`, (cb) => approve.mutate({ id, data: { parentAccountId: accountId } }, cb), t('Approved and paid', 'تمت الموافقة والدفع'));
  }
  const setter = (k: 'approve' | 'decline' | 'ask') => (o: boolean) => { setOpen(o ? k : null); if (o) setErrs((s) => ({ ...s, [k]: undefined })); };

  return (
    <Page>
      <PageHeader eyebrow={t('REQUEST REVIEW', 'مراجعة الطلب')} title={request?.reason ?? t('Request', 'الطلب')} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => Promise.all([q.refetch(), wallet.refetch()])}>
        {gone ? <NotFoundRequest t={t} back="/parent/requests" />
          : q.isPending ? <SkeletonRows rows={4} label={t('Loading request', 'جارٍ تحميل الطلب')} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load this request', 'تعذّر تحميل الطلب')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'حاول مجدداً')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : <>
              {wallet.isError ? <StatePanel tone="error" className="py-4" title={t('Couldn’t load your wallet', 'تعذّر تحميل محفظتك')} body={apiErrorText(wallet.error, t)}
                  action={<RetryButton label={t('Try again', 'حاول مجدداً')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={wallet.isFetching} onClick={() => void wallet.refetch()} />} /> : null}
              <ParentRequestReview t={t} request={q.data} child={name(q.data.studentId)} payFromAccounts={payFrom} walletLoading={wallet.isPending || wallet.isError}
                approve={{ open: open === 'approve', setOpen: setter('approve'), pending: approve.isPending, error: errs.approve, run: onApprove }}
                decline={{ open: open === 'decline', setOpen: setter('decline'), pending: decline.isPending, error: errs.decline,
                  run: () => run('decline', `decline:${id}`, (cb) => decline.mutate({ id }, cb), t('Request declined', 'تم رفض الطلب')) }}
                askDetails={{ open: open === 'ask', setOpen: setter('ask'), pending: ask.isPending, error: errs.ask,
                  run: (message) => run('ask', `ask:${id}:${message}`, (cb) => ask.mutate({ id, data: { message } }, cb), t('Question sent', 'تم إرسال السؤال')) }} />
            </>}
      </PullToRefresh>
    </Page>
  );
}
