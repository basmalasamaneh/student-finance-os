import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  getGetStudentFamilyQueryKey, getGetStudentFamilyRequestQueryKey, getListFinanceAccountsQueryKey, getListStudentFamilyRequestsQueryKey,
  useCancelFamilyRequest, useCreateFamilyMoneyRequest, useGetStudentFamily, useGetStudentFamilyRequest, useListFinanceAccounts,
  useListStudentFamilyRequests, useReplyToFamilyRequest,
} from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { NewFamilyRequestSheet, StudentFamilyRequestDetail, StudentFamilyRequestsView, guardianName, type NewFamilyRequestBody } from '@/components/requests/student-family-requests';
import { NotFoundRequest } from '@/components/requests/request-shared';
import { useAccount } from '@/features/auth/account';
import { useToast } from '@/hooks/use-toast';
import { FAMILY_REFETCH, isGone, linkState, useKeyRing } from '@/features/family/family-view';
import { STUDENT_REQUEST_REFETCH, answered, retryUnlessGone, useAfterRequestMutation, useDropRequestCache } from '@/features/requests/use-family-requests';
import { accountName, apiErrorText, useTx } from '@/features/money/money-model';

function StudentOnly({ children }: { children: React.ReactNode }) {
  const t = useTx();
  const me = useAccount();
  if (me.role !== 'student') return <Page><StatePanel tone="permission" title={t('For student accounts', 'لحسابات الطلاب')} body={t('Students send family requests; parents review them under Requests.', 'يرسل الطلاب الطلبات العائلية؛ ويراجعها أولياء الأمور في صفحة الطلبات.')} /></Page>;
  return <>{children}</>;
}

export default function FamilyRequestsPage() {
  return <StudentOnly><ListInner /></StudentOnly>;
}

function ListInner() {
  const t = useTx();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const after = useAfterRequestMutation();
  const ring = useKeyRing();
  const list = useListStudentFamilyRequests({ query: { queryKey: getListStudentFamilyRequestsQueryKey(), ...STUDENT_REQUEST_REFETCH } });
  const fam = useGetStudentFamily({ query: { queryKey: getGetStudentFamilyQueryKey(), ...FAMILY_REFETCH, refetchOnWindowFocus: true } });
  const accts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey() } });
  const create = useCreateFamilyMoneyRequest({ request: { headers: ring.headers } });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const links = fam.data?.links ?? [];
  const guardians = links.filter((l) => linkState(l) === 'accepted' && l.permissions.requests);
  const loading = list.isPending || fam.isPending;
  const err = list.isError ? list.error : fam.isError ? fam.error : null;

  function submit(body: NewFamilyRequestBody) {
    const fp = `create:${JSON.stringify(body)}`; ring.prime(fp); setError(undefined);
    create.mutate({ data: body }, {
      onSuccess: (r) => { ring.done(fp); setOpen(false); void after(); toast({ title: t('Request sent', 'تم إرسال الطلب') }); navigate(`/family/requests/${r.id}`); },
      onError: (e) => { if (answered(e)) ring.done(fp); setError(apiErrorText(e, t)); },
    });
  }

  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Family requests', 'الطلبات العائلية')}
        lede={t('Ask a guardian who shares requests with you. Simulated money only.', 'اطلب من وليّ أمر يشاركك الطلبات. أموال تجريبية فقط.')} />
      <StudentFamilyRequestsView t={t} requests={list.data ?? []} links={links} canRequest={guardians.length > 0}
        onNew={() => { setError(undefined); setOpen(true); }}
        state={{ loading, error: err ? apiErrorText(err, t) : undefined, retrying: list.isFetching || fam.isFetching,
          onRetry: () => { void list.refetch(); void fam.refetch(); }, onRefresh: () => Promise.all([list.refetch(), fam.refetch(), accts.refetch()]) }} />
      <NewFamilyRequestSheet t={t} open={open} onOpenChange={setOpen} guardians={guardians} accounts={accts.data ?? []}
        pending={create.isPending} error={error} onSubmit={submit} />
    </Page>
  );
}

export function FamilyRequestDetailPage() {
  return <StudentOnly><DetailInner /></StudentOnly>;
}

function DetailInner() {
  const t = useTx();
  const me = useAccount();
  const id = useParams().id ?? '';
  const { toast } = useToast();
  const after = useAfterRequestMutation();
  const drop = useDropRequestCache();
  const ring = useKeyRing();
  const q = useGetStudentFamilyRequest(id, { query: { queryKey: getGetStudentFamilyRequestQueryKey(id), enabled: !!id, ...STUDENT_REQUEST_REFETCH, retry: retryUnlessGone } });
  const fam = useGetStudentFamily({ query: { queryKey: getGetStudentFamilyQueryKey(), ...FAMILY_REFETCH } });
  const accts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey() } });
  const reply = useReplyToFamilyRequest({ request: { headers: ring.headers } });
  const cancel = useCancelFamilyRequest({ request: { headers: ring.headers } });
  const [replyOpen, setReplyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [replyErr, setReplyErr] = useState<string>();
  const [cancelErr, setCancelErr] = useState<string>();
  const gone = q.isError && isGone(q.error);
  useEffect(() => { if (gone) drop('/api/family/requests', getGetStudentFamilyRequestQueryKey(id)[0]); }, [gone, drop, id]);

  function onReply(message: string) {
    const fp = `reply:${id}:${message}`; ring.prime(fp); setReplyErr(undefined);
    reply.mutate({ id, data: { message } }, {
      onSuccess: () => { ring.done(fp); setReplyOpen(false); void after(); toast({ title: t('Reply sent', 'تم إرسال الرد') }); },
      onError: (e) => { if (answered(e)) ring.done(fp); setReplyErr(apiErrorText(e, t)); void after(); },
    });
  }
  function onCancel() {
    const fp = `cancel:${id}`; ring.prime(fp); setCancelErr(undefined);
    cancel.mutate({ id }, {
      onSuccess: () => { ring.done(fp); setCancelOpen(false); void after(); toast({ title: t('Request cancelled', 'تم إلغاء الطلب') }); },
      onError: (e) => { if (answered(e)) ring.done(fp); setCancelErr(apiErrorText(e, t)); void after(); },
    });
  }

  const link = fam.data?.links.find((l) => l.id === q.data?.familyLinkId);
  const acct = accts.data?.find((a) => a.id === q.data?.receivingAccountId);
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY REQUEST', 'طلب عائلي')} title={q.data?.reason ?? t('Request', 'الطلب')} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => Promise.all([q.refetch(), fam.refetch()])}>
        {gone ? <NotFoundRequest t={t} back="/family/requests" />
          : q.isPending ? <SkeletonRows rows={4} label={t('Loading request', 'جارٍ تحميل الطلب')} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load this request', 'تعذّر تحميل الطلب')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'حاول مجدداً')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : <StudentFamilyRequestDetail t={t} request={q.data} guardian={guardianName(link, t)} studentLabel={me.name || t('You', 'أنت')}
              receivingAccountLabel={acct ? accountName(acct, t) : undefined}
              reply={{ open: replyOpen, setOpen: (o) => { setReplyOpen(o); if (o) setReplyErr(undefined); }, pending: reply.isPending, error: replyErr, onSubmit: onReply }}
              cancel={{ open: cancelOpen, setOpen: (o) => { setCancelOpen(o); if (o) setCancelErr(undefined); }, pending: cancel.isPending, error: cancelErr, onConfirm: onCancel }} />}
      </PullToRefresh>
    </Page>
  );
}
