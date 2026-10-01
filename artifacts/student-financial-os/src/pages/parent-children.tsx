import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { UserPlus } from 'lucide-react';
import {
  getGetParentChildQueryKey, getGetParentDashboardQueryKey, getListChildAllowancesQueryKey,
  useDecideFamilyInvitation, useGetParentChild, useGetParentDashboard,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Page, PageHeader } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { AcceptCodeDialog, ChildSummaryCard, NoChildren } from '@/components/family/parent-children';
import { ParentOnly } from '@/components/family/parent-only';
import { apiErrorText, useTx, type Tx } from '@/features/money/money-model';
import { FAMILY_REFETCH, isGone, useRefreshFamily } from '@/features/family/family-view';

export function useAcceptCode() {
  const refresh = useRefreshFamily();
  const m = useDecideFamilyInvitation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const decide = (token: string, action: 'accept' | 'decline') => {
    setPending(action);
    m.mutate({ data: { token, action } }, { onSuccess: () => void refresh(), onSettled: () => setPending(null) });
  };
  const openDialog = () => { m.reset(); setOpen(true); };
  return { open, setOpen, openDialog, decide, pending, m };
}

export function AcceptCodeHost({ c, t }: { c: ReturnType<typeof useAcceptCode>; t: Tx }) {
  return <AcceptCodeDialog open={c.open} onOpenChange={(o) => { c.setOpen(o); if (!o) c.m.reset(); }} onDecide={c.decide} pending={c.pending}
    error={c.m.isError ? apiErrorText(c.m.error, t) : null} result={c.m.data ?? null} t={t} />;
}

export default function ParentChildrenPage() {
  const t = useTx();
  return <ParentOnly t={t}><ChildrenInner /></ParentOnly>;
}

function ChildrenInner() {
  const t = useTx();
  const accept = useAcceptCode();
  const q = useGetParentDashboard({ query: { queryKey: getGetParentDashboardQueryKey(), ...FAMILY_REFETCH } });
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Children', 'الأبناء')} lede={t('You see only what each child chose to share.', 'ترى فقط ما اختار كل ابن مشاركته.')}
        actions={<Button onClick={accept.openDialog} data-testid="button-enter-code"><UserPlus />{t('Enter a code', 'إدخال رمز')}</Button>} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => q.refetch()}>
        {q.isPending ? <SkeletonRows rows={3} label={t('Loading children', 'جارٍ تحميل الأبناء')} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load children', 'تعذّر تحميل الأبناء')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : !q.data.children.length ? <NoChildren onConnect={accept.openDialog} t={t} />
          : <div className="grid gap-4 md:grid-cols-2" data-testid="list-children">{q.data.children.map((c) => <ChildSummaryCard key={c.childId} child={c} t={t} />)}</div>}
      </PullToRefresh>
      <AcceptCodeHost c={accept} t={t} />
    </Page>
  );
}

export function ParentChildDetailPage() {
  const t = useTx();
  return <ParentOnly t={t}><ChildDetailInner /></ParentOnly>;
}

function ChildDetailInner() {
  const t = useTx();
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useGetParentChild(id, { query: { queryKey: getGetParentChildQueryKey(id), enabled: !!id, ...FAMILY_REFETCH } });
  const gone = q.isError && isGone(q.error);
  useEffect(() => {
    if (!gone) return;
    qc.removeQueries({ queryKey: getGetParentChildQueryKey(id) });
    qc.removeQueries({ queryKey: getListChildAllowancesQueryKey(id) });
    void qc.invalidateQueries({ queryKey: getGetParentDashboardQueryKey() });
  }, [gone, id, qc]);
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={q.data && !q.isError ? q.data.name : t('Child', 'الابن')} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => q.refetch()}>
        {q.isPending ? <SkeletonRows rows={5} label={t('Loading', 'جارٍ التحميل')} />
          : gone ? <StatePanel tone="permission" title={t('Access no longer available', 'لم يعد الوصول متاحاً')} body={t('This child stopped sharing or the link was removed. Nothing from before is shown.', 'أوقف الابن المشاركة أو أُزيل الرابط. لا يُعرض شيء سابق.')}
              action={<Link href="/parent/children" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline">{t('Back to children', 'العودة للأبناء')}</Link>} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load details', 'تعذّر تحميل التفاصيل')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : <ChildSummaryCard child={q.data} t={t} detailed />}
      </PullToRefresh>
    </Page>
  );
}
