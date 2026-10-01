import { useState } from 'react';
import { Link } from 'wouter';
import { UserPlus } from 'lucide-react';
import {
  getGetStudentFamilyQueryKey, getListFinanceAccountsQueryKey, useCreateFamilyInvitation, useGetStudentFamily, useListFinanceAccounts,
  useRevokeFamilyLink, useUpdateFamilyConsent, type FamilyLink, type FamilyPermissions,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { EditPermissionsDialog, FamilyInviteDialog, FamilyLinkList, RevokeLinkConfirm } from '@/components/family/family-links';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { formatDate } from '@/lib/money';
import { apiErrorText, useTx } from '@/features/money/money-model';
import { ALLOWANCE_STATUS, day, failureText, FAMILY_REFETCH, FREQUENCY_TEXT, useRefreshFamily } from '@/features/family/family-view';

export default function FamilyPage() {
  const t = useTx();
  const me = useAccount();
  if (me.role !== 'student') return <Page><StatePanel tone="permission" title={t('Family sharing is set by students', 'المشاركة العائلية يحددها الطلاب')} body={t('Parents connect from Children using a private code.', 'يتصل أولياء الأمور من صفحة الأبناء باستخدام رمز خاص.')} /></Page>;
  return <Inner />;
}

function Inner() {
  const t = useTx();
  const { locale } = useI18n();
  const refresh = useRefreshFamily();
  const q = useGetStudentFamily({ query: { queryKey: getGetStudentFamilyQueryKey(), ...FAMILY_REFETCH } });
  const accts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey() } });
  const accounts = accts.data ?? [];
  const create = useCreateFamilyInvitation();
  const update = useUpdateFamilyConsent();
  const revoke = useRevokeFamilyLink();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<FamilyLink | null>(null);
  const [revoking, setRevoking] = useState<FamilyLink | null>(null);

  const openInvite = () => { setToken(null); create.reset(); setInviteOpen(true); };
  const doCreate = (permissions: FamilyPermissions, receivingAccountId: string | null) => {
    if (create.isPending) return;
    create.mutate({ data: { permissions, receivingAccountId } }, { onSuccess: (r) => { setToken(r.token); void refresh(); } });
  };
  const doSave = (permissions: FamilyPermissions, receivingAccountId: string | null) => {
    if (!editing || update.isPending) return;
    update.mutate({ id: editing.id, data: { permissions, receivingAccountId } }, { onSuccess: () => { setEditing(null); void refresh(); } });
  };
  const doRevoke = () => {
    if (!revoking || revoke.isPending) return;
    revoke.mutate({ id: revoking.id }, { onSuccess: () => { setRevoking(null); void refresh(); } });
  };
  const totals = q.data?.projection.totals.filter((x) => x.scheduledMonthly.minor > 0 || x.manualMonthly.minor > 0) ?? [];

  return (
    <Page>
      <PageHeader eyebrow={t('FAMILY', 'العائلة')} title={t('Family sharing', 'المشاركة العائلية')} lede={t('You decide what each parent sees. Everything starts private.', 'أنت تقرر ما يراه كل ولي أمر. كل شيء خاص افتراضياً.')}
        actions={<Button onClick={openInvite} data-testid="button-invite-parent"><UserPlus />{t('Invite a parent', 'دعوة ولي أمر')}</Button>} />
      <PullToRefresh label={t('Pull to refresh', 'اسحب للتحديث')} onRefresh={() => Promise.all([q.refetch(), accts.refetch()])}>
        {q.isPending ? <SkeletonRows rows={4} label={t('Loading family', 'جارٍ تحميل العائلة')} />
          : q.isError ? <StatePanel tone="error" title={t('Couldn’t load family sharing', 'تعذّر تحميل المشاركة العائلية')} body={apiErrorText(q.error, t)}
              action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
          : <>
            <section className="py-4" aria-labelledby="links-title"><SectionHeading id="links-title" title={t('Parents', 'أولياء الأمور')} />
              <FamilyLinkList links={q.data.links} onInvite={openInvite} onEdit={(l) => { update.reset(); setEditing(l); }} onRevoke={(l) => { revoke.reset(); setRevoking(l); }} t={t} />
            </section>
            <section className="border-t border-divider py-6" aria-labelledby="allow-title" data-testid="section-student-allowances">
              <SectionHeading id="allow-title" title={t('Allowances you receive', 'المصروفات التي تستلمها')} meta={t('Read-only', 'للعرض فقط')} />
              {!q.data.allowances.length ? <StatePanel tone="empty" title={t('No allowances yet', 'لا مصروفات بعد')} body={t('When a parent you allowed schedules one, it shows here.', 'عندما يجدول ولي أمر سمحت له مصروفاً، يظهر هنا.')} />
                : <ul className="divide-y divide-divider">{q.data.allowances.map((a) => {
                  const f = failureText(a.lastFailure, t);
                  return <li key={a.id} className="flex flex-col gap-1 py-3" data-testid={`row-student-allowance-${a.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex flex-wrap items-center gap-2 type-label">{a.frequency ? t(...FREQUENCY_TEXT[a.frequency]) : t('One-time', 'مرة واحدة')}<StatusBadge tone={ALLOWANCE_STATUS[a.status].tone} label={t(...ALLOWANCE_STATUS[a.status].text)} /></span>
                      <MoneyDisplay value={a.amount} size="sm" />
                    </div>
                    {a.status === 'active' || a.status === 'paused' ? <span className="type-caption text-muted-foreground">{t('Next', 'التالي')} {formatDate(day(a.nextPayment), locale)}{a.endDate ? ` · ${t('Until', 'حتى')} ${formatDate(day(a.endDate), locale)}` : ''}</span> : null}
                    {f && (a.status === 'active' || a.status === 'paused') ? <span className="type-caption text-muted-foreground">{t('A payment is delayed on the parent’s side. It’s an estimate, not guaranteed.', 'دفعة متأخرة من جهة ولي الأمر. إنها تقدير وليست مضمونة.')}</span> : null}
                    {a.note ? <span className="type-caption break-words text-muted-foreground" dir="auto">{a.note}</span> : null}
                  </li>;
                })}</ul>}
            </section>
            {totals.length ? <section className="border-t border-divider py-6" aria-labelledby="proj-title" data-testid="section-allowance-projection">
              <SectionHeading id="proj-title" title={t('How allowances count in your plan', 'كيف تُحتسب المصروفات في خطتك')} meta={t('Estimate', 'تقدير')} />
              <ul className="flex flex-col gap-3">{totals.map((x) => (
                <li key={x.currency} className="grid grid-cols-3 gap-2 type-caption" data-testid={`row-projection-${x.currency}`}>
                  <span className="flex flex-col"><span className="text-muted-foreground">{t('Profile envelope', 'مبلغ الملف')}</span><MoneyDisplay value={x.manualMonthly} size="sm" tone="projected" /></span>
                  <span className="flex flex-col"><span className="text-muted-foreground">{t('Scheduled', 'المجدول')}</span><MoneyDisplay value={x.scheduledMonthly} size="sm" tone="projected" /></span>
                  <span className="flex flex-col"><span className="text-muted-foreground">{t('Counted', 'المحتسب')}</span><MoneyDisplay value={x.effectiveMonthly} size="sm" tone="projected" /></span>
                </li>))}</ul>
              <p className="type-caption pt-3 text-muted-foreground">{t('Your plan counts the larger of the parent allowance in your profile or the scheduled allowances — never both. Your saved income isn’t changed.', 'تحتسب خطتك الأكبر بين مصروف ولي الأمر في ملفك أو المصروفات المجدولة — لا كليهما. لا يتغير دخلك المحفوظ.')}{' '}
                <Link href="/profile" className="text-gold-ink underline-offset-4 hover:underline" data-testid="link-edit-envelope">{t('Edit profile income', 'تعديل دخل الملف')}</Link></p>
            </section> : null}
          </>}
      </PullToRefresh>
      <FamilyInviteDialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setToken(null); }} onSubmit={doCreate} pending={create.isPending}
        error={create.isError ? apiErrorText(create.error, t) : null} token={token} accounts={accounts} t={t} />
      <EditPermissionsDialog link={editing} onOpenChange={(o) => { if (!o) setEditing(null); }} onSave={doSave} pending={update.isPending}
        error={update.isError ? apiErrorText(update.error, t) : null} accounts={accounts} t={t} />
      <RevokeLinkConfirm link={revoking} onOpenChange={(o) => { if (!o) setRevoking(null); }} onConfirm={doRevoke} pending={revoke.isPending}
        error={revoke.isError ? apiErrorText(revoke.error, t) : null} t={t} />
    </Page>
  );
}
