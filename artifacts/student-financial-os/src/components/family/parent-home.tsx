import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, UserPlus } from 'lucide-react';
import { getGetParentDashboardQueryKey, getGetParentWalletQueryKey, useGetParentDashboard, useGetParentWallet } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionHeading } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { SimulatedNote } from '@/components/money/fields';
import { ChildSummaryCard, NoChildren } from '@/components/family/parent-children';
import { ParentCreateAccountDialog, ParentWalletPanel, TopUpDialog } from '@/components/family/parent-wallet';
import { AcceptCodeHost, useAcceptCode } from '@/pages/parent-children';
import { apiErrorText, type Tx } from '@/features/money/money-model';
import { FAMILY_REFETCH } from '@/features/family/family-view';

const linkCls = 'type-label inline-flex min-h-11 items-center gap-1 text-gold-ink underline-offset-4 hover:underline';

/** Parent home: own simulated wallet + permission-filtered children. No student finance hooks. */
export function ParentHome({ name, t }: { name: string; t: Tx }) {
  const dash = useGetParentDashboard({ query: { queryKey: getGetParentDashboardQueryKey(), ...FAMILY_REFETCH } });
  const wallet = useGetParentWallet({ query: { queryKey: getGetParentWalletQueryKey(), ...FAMILY_REFETCH } });
  const accept = useAcceptCode();
  const [acctOpen, setAcctOpen] = useState(false);
  const [topUp, setTopUp] = useState<{ open: boolean; id?: string }>({ open: false });
  const retry = (q: { refetch: () => Promise<unknown>; isFetching: boolean }) => <RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />;
  return (
    <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => Promise.all([dash.refetch(), wallet.refetch()])}>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t(`Welcome, ${name}`, `مرحباً، ${name}`)} lede={t('Your simulated wallet and what your children share with you.', 'محفظتك التجريبية وما يشاركه أبناؤك معك.')}
        actions={<Button variant="secondary" onClick={accept.openDialog} data-testid="button-home-enter-code"><UserPlus />{t('Enter a code', 'إدخال رمز')}</Button>} />
      <section className="py-6" aria-labelledby="wallet-title" data-testid="section-parent-wallet">
        <SectionHeading id="wallet-title" title={t('Your wallet', 'محفظتك')} meta={t('Simulated', 'محاكاة')} />
        {wallet.isPending ? <SkeletonRows rows={3} label={t('Loading wallet', 'جارٍ تحميل المحفظة')} />
          : wallet.isError ? <StatePanel tone="error" title={t('Couldn’t load your wallet', 'تعذّر تحميل محفظتك')} body={apiErrorText(wallet.error, t)} action={retry(wallet)} />
          : <ParentWalletPanel wallet={wallet.data} t={t} onCreate={() => setAcctOpen(true)} onTopUp={(id) => setTopUp({ open: true, id })} />}
        <SimulatedNote t={t} className="mt-4" />
      </section>
      <section className="border-t border-divider py-6" aria-labelledby="kids-title" data-testid="section-parent-children">
        <SectionHeading id="kids-title" title={t('Children', 'الأبناء')} trailing={<Link href="/parent/children" className={linkCls} data-testid="link-all-children">{t('All', 'الكل')}<ArrowUpRight className="size-4" /></Link>} />
        {dash.isPending ? <SkeletonRows rows={3} label={t('Loading children', 'جارٍ تحميل الأبناء')} />
          : dash.isError ? <StatePanel tone="error" title={t('Couldn’t load children', 'تعذّر تحميل الأبناء')} body={apiErrorText(dash.error, t)} action={retry(dash)} />
          : !dash.data.children.length ? <NoChildren onConnect={accept.openDialog} t={t} />
          : <div className="grid gap-4 md:grid-cols-2">{dash.data.children.map((c) => <ChildSummaryCard key={c.childId} child={c} t={t} />)}</div>}
      </section>
      <section className="border-t border-divider py-6" aria-label={t('Shortcuts', 'اختصارات')}>
        <ul className="flex flex-col gap-1">
          <li><Link href="/parent/allowances" className={linkCls} data-testid="link-home-allowances">{t('Manage allowances', 'إدارة المصروفات')}</Link></li>
          <li><Link href="/parent/requests" className={linkCls} data-testid="link-home-requests">{t('Requests — coming soon', 'الطلبات — قريباً')}</Link></li>
          <li><Link href={dash.data?.goalFundingPath ?? '/goals/fund'} className={linkCls} data-testid="link-home-fund-goal">{t('Fund a goal you were invited to', 'تمويل هدف دُعيت إليه')}</Link>
            <p className="type-caption text-muted-foreground">{t('Goal funding needs a separate goal invitation and stays simulated external — it doesn’t use this wallet.', 'تمويل الأهداف يحتاج دعوة هدف منفصلة ويبقى خارجياً تجريبياً — لا يستخدم هذه المحفظة.')}</p></li>
        </ul>
      </section>
      <AcceptCodeHost c={accept} t={t} />
      <ParentCreateAccountDialog open={acctOpen} onOpenChange={setAcctOpen} t={t} />
      <TopUpDialog open={topUp.open} onOpenChange={(o) => setTopUp((s) => ({ ...s, open: o }))} accounts={wallet.data?.accounts ?? []} initialAccountId={topUp.id} t={t} />
    </PullToRefresh>
  );
}
