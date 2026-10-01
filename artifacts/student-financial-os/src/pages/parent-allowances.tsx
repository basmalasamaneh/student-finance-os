import { useState } from 'react';
import { getGetParentDashboardQueryKey, getGetParentWalletQueryKey, useGetParentDashboard, useGetParentWallet } from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { SimulatedNote } from '@/components/money/fields';
import { ChildAllowances } from '@/components/family/child-allowances';
import { ParentCreateAccountDialog } from '@/components/family/parent-wallet';
import { ParentOnly } from '@/components/family/parent-only';
import { apiErrorText, useTx } from '@/features/money/money-model';
import { FAMILY_REFETCH } from '@/features/family/family-view';

export default function ParentAllowancesPage() {
  const t = useTx();
  return <ParentOnly t={t}><Inner /></ParentOnly>;
}

function Inner() {
  const t = useTx();
  const dash = useGetParentDashboard({ query: { queryKey: getGetParentDashboardQueryKey(), ...FAMILY_REFETCH } });
  const wallet = useGetParentWallet({ query: { queryKey: getGetParentWalletQueryKey(), ...FAMILY_REFETCH } });
  const [acct, setAcct] = useState<{ open: boolean; currency?: string }>({ open: false });
  const permitted = dash.data?.children.filter((c) => c.permissions.allowance) ?? [];
  const notPermitted = (dash.data?.children.length ?? 0) - permitted.length;
  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Allowances', 'المصروفات')} lede={t('Scheduled payments from your simulated wallet to your children.', 'دفعات مجدولة من محفظتك التجريبية لأبنائك.')} />
      <SimulatedNote t={t} className="mb-6" />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => Promise.all([dash.refetch(), wallet.refetch()])}>
        {dash.isPending || wallet.isPending ? <SkeletonRows rows={4} label={t('Loading allowances', 'جارٍ تحميل المصروفات')} />
          : dash.isError || wallet.isError ? <StatePanel tone="error" title={t('Couldn’t load allowances', 'تعذّر تحميل المصروفات')} body={apiErrorText(dash.error ?? wallet.error, t)}
              action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={dash.isFetching || wallet.isFetching} onClick={() => { void dash.refetch(); void wallet.refetch(); }} />} />
          : !dash.data.children.length ? <StatePanel tone="empty" title={t('No children connected', 'لا أبناء متصلون')} body={t('Connect with your child from Children using their private code.', 'اتصل بابنك من صفحة الأبناء باستخدام رمزه الخاص.')} />
          : !permitted.length ? <StatePanel tone="permission" title={t('Allowance not shared yet', 'المصروف غير مشترك بعد')} body={t('Your child needs to turn on Allowance and pick a receiving account in their Family settings.', 'يحتاج ابنك لتفعيل المصروف واختيار حساب مستلم في إعدادات العائلة.')} />
          : <div>
              {permitted.map((c) => <ChildAllowances key={c.childId} childId={c.childId} childName={c.name} allowanceCurrency={c.allowanceCurrency} accounts={wallet.data.accounts} onNeedAccount={(currency) => setAcct({ open: true, currency })} t={t} />)}
              {notPermitted > 0 ? <p className="type-caption border-t border-divider pt-4 text-muted-foreground">{t(`${notPermitted} connected child hasn’t shared allowance.`, `${notPermitted} من الأبناء لم يشارك المصروف.`)}</p> : null}
            </div>}
      </PullToRefresh>
      <ParentCreateAccountDialog open={acct.open} onOpenChange={(o) => setAcct((s) => ({ ...s, open: o }))} initialCurrency={acct.currency} t={t} />
    </Page>
  );
}
