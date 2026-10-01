import { getGetParentDashboardQueryKey, useGetParentDashboard } from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { ParentRequestsComingSoon } from '@/components/family/requests-coming-soon';
import { ParentOnly } from '@/components/family/parent-only';
import { apiErrorText, useTx } from '@/features/money/money-model';
import { FAMILY_REFETCH } from '@/features/family/family-view';

export default function ParentRequestsPage() {
  const t = useTx();
  return <ParentOnly t={t}><Inner /></ParentOnly>;
}

function Inner() {
  const t = useTx();
  const q = useGetParentDashboard({ query: { queryKey: getGetParentDashboardQueryKey(), ...FAMILY_REFETCH } });
  const shared = q.data?.children.filter((c) => c.requests) ?? [];
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Requests', 'الطلبات')} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => q.refetch()}>
        {q.isPending ? <SkeletonRows rows={2} label={t('Loading', 'جارٍ التحميل')} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load', 'تعذّر التحميل')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : <ParentRequestsComingSoon t={t}>
              {shared.length ? <ul className="divide-y divide-divider" data-testid="list-request-sharing">{shared.map((c) => (
                <li key={c.childId} className="flex min-h-11 items-center justify-between gap-3 py-2 type-label"><span>{c.name}</span>
                  <span className="type-caption text-muted-foreground">{t('Shares requests · none yet', 'يشارك الطلبات · لا شيء بعد')}</span></li>))}</ul> : null}
            </ParentRequestsComingSoon>}
      </PullToRefresh>
    </Page>
  );
}
