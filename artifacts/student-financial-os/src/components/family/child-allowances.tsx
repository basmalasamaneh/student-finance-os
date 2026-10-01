import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  getGetParentChildQueryKey, getGetParentDashboardQueryKey, getListChildAllowancesQueryKey,
  useChangeAllowanceStatus, useCreateAllowance, useListChildAllowances, useRetryAllowance, useUpdateAllowance,
  type Allowance, type AllowanceInput, type FinanceAccount,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/layout/page';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { AllowanceConfirm, AllowanceFormDialog, AllowanceRow } from '@/components/family/allowances';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, type Tx } from '@/features/money/money-model';
import { failureText, FAMILY_REFETCH, isGone, useKeyRing, useRefreshFamily, type AllowanceAction } from '@/features/family/family-view';

/** One child's allowance schedules for this parent, with every action wired. */
export function ChildAllowances({ childId, childName, allowanceCurrency, accounts: allAccounts, onNeedAccount, t }: {
  childId: string; childName: string; allowanceCurrency?: string; accounts: FinanceAccount[]; onNeedAccount: (currency?: string) => void; t: Tx;
}) {
  // Only accounts in the child's receiving currency can fund an allowance (no FX). Unknown currency → none offered.
  const accounts = allowanceCurrency ? allAccounts.filter((a) => a.currency === allowanceCurrency) : [];
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = useRefreshFamily();
  const q = useListChildAllowances(childId, { query: { queryKey: getListChildAllowancesQueryKey(childId), ...FAMILY_REFETCH } });
  const gone = q.isError && isGone(q.error);
  useEffect(() => {
    if (!gone) return;
    qc.removeQueries({ queryKey: getListChildAllowancesQueryKey(childId) });
    qc.removeQueries({ queryKey: getGetParentChildQueryKey(childId) });
    void qc.invalidateQueries({ queryKey: getGetParentDashboardQueryKey() });
  }, [gone, childId, qc]);

  const ring = useKeyRing();
  const create = useCreateAllowance({ request: { headers: ring.headers } });
  const update = useUpdateAllowance({ request: { headers: ring.headers } });
  const status = useChangeAllowanceStatus({ request: { headers: ring.headers } });
  const retry = useRetryAllowance({ request: { headers: ring.headers } });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);
  const [confirm, setConfirm] = useState<{ a: Allowance; action: 'cancel' | 'retry' } | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: AllowanceAction } | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; msg: string } | null>(null);
  const formMutation = editing ? update : create;

  const submit = (data: AllowanceInput) => {
    if (formMutation.isPending) return;
    const fp = `${editing ? `u:${editing.id}` : `c:${childId}`}|${JSON.stringify(data)}`; ring.prime(fp);
    const onSuccess = () => { ring.done(fp); setFormOpen(false); setEditing(null); void refresh(); toast({ title: t('Allowance saved', 'تم حفظ المصروف') }); };
    if (editing) update.mutate({ childId, id: editing.id, data }, { onSuccess });
    else create.mutate({ childId, data }, { onSuccess });
  };
  const runStatus = (a: Allowance, action: 'pause' | 'resume' | 'cancel') => {
    const fp = `s:${a.id}|${action}|${a.status}`; ring.prime(fp); setBusy({ id: a.id, action }); setRowErr(null);
    status.mutate({ childId, id: a.id, data: { action } }, {
      onSuccess: () => { ring.done(fp); setConfirm(null); void refresh(); },
      onError: (e) => { if (action !== 'cancel') setRowErr({ id: a.id, msg: apiErrorText(e, t) }); },
      onSettled: () => setBusy(null),
    });
  };
  const runRetry = (a: Allowance) => {
    const fp = `r:${a.id}|${a.occurrences.length}|${a.lastFailure}`; ring.prime(fp); setBusy({ id: a.id, action: 'retry' });
    retry.mutate({ childId, id: a.id, data: { retry: true } }, {
      onSuccess: (r) => {
        ring.done(fp); setConfirm(null); void refresh();
        const f = failureText(r.lastFailure, t);
        toast(f ? { title: t('Payment didn’t go through', 'لم تتم الدفعة'), description: f, variant: 'destructive' } : { title: t('Processed', 'تمت المعالجة') });
      },
      onSettled: () => setBusy(null),
    });
  };
  const onAction = (a: Allowance, act: AllowanceAction) => {
    if (act === 'edit') { setEditing(a); setFormOpen(true); }
    else if (act === 'pause' || act === 'resume') runStatus(a, act);
    else setConfirm({ a, action: act });
  };
  const startCreate = () => { if (!accounts.length) { onNeedAccount(allowanceCurrency); return; } setEditing(null); create.reset(); setFormOpen(true); };

  const NoCompatible = () => <p role="status" className="type-caption mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning" data-testid={`text-no-compatible-${childId}`}>
    {t(`No ${allowanceCurrency} account to pay from. New allowances need one.`, `لا يوجد حساب ${allowanceCurrency} للدفع منه. المصروفات الجديدة تحتاجه.`)}
    <Button size="sm" variant="secondary" onClick={() => onNeedAccount(allowanceCurrency)} data-testid={`button-create-compatible-${childId}`}>{t(`Create ${allowanceCurrency} account`, `إنشاء حساب ${allowanceCurrency}`)}</Button></p>;
  return (
    <section className="border-t border-divider py-6" aria-labelledby={`allow-${childId}`} data-testid={`section-child-allowances-${childId}`}>
      <SectionHeading id={`allow-${childId}`} title={childName} meta={allowanceCurrency ? t(`Receives ${allowanceCurrency}`, `يستلم ${allowanceCurrency}`) : undefined}
        trailing={!gone ? <Button size="sm" onClick={startCreate} data-testid={`button-new-allowance-${childId}`}><Plus />{t('New', 'جديد')}</Button> : undefined} />
      {q.isPending ? <SkeletonRows rows={2} label={t('Loading allowances', 'جارٍ تحميل المصروفات')} />
        : gone ? <StatePanel tone="permission" title={t('Access no longer available', 'لم يعد الوصول متاحاً')} body={t(`${childName} changed what they share. Nothing from before is shown.`, `غيّر ${childName} ما يشاركه. لا يُعرض شيء سابق.`)} />
        : q.isError ? <StatePanel tone="error" title={t('Couldn’t load allowances', 'تعذّر تحميل المصروفات')} body={apiErrorText(q.error, t)}
            action={<RetryButton label={t('Try again', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => void q.refetch()} />} />
        : !q.data.length ? <StatePanel tone="empty" title={t('No allowances yet', 'لا مصروفات بعد')} body={accounts.length ? t('Schedule a one-time or recurring allowance.', 'جدول مصروفاً لمرة واحدة أو متكرراً.') : !allowanceCurrency ? t('Your child’s receiving currency isn’t available yet. Pull to refresh.', 'عملة الحساب المستلم غير متاحة بعد. اسحب للتحديث.') : t(`You have no ${allowanceCurrency} account. ${childName} receives in ${allowanceCurrency} and there’s no conversion — create a ${allowanceCurrency} account, then add simulated money.`, `ليس لديك حساب ${allowanceCurrency}. يستلم ${childName} بعملة ${allowanceCurrency} ولا تحويل — أنشئ حساب ${allowanceCurrency} ثم أضف مالاً تجريبياً.`)}
            action={!accounts.length && !allowanceCurrency ? undefined : <Button variant="secondary" onClick={startCreate} data-testid={`button-new-allowance-empty-${childId}`}>{accounts.length ? t('New allowance', 'مصروف جديد') : t(`Create ${allowanceCurrency ?? ''} account`, `إنشاء حساب ${allowanceCurrency ?? ''}`)}</Button>} />
        : <>{!accounts.length && allowanceCurrency ? <NoCompatible /> : null}<ul className="divide-y divide-divider">{q.data.map((a) => <AllowanceRow key={a.id} a={a} t={t} onAction={onAction} busyAction={busy?.id === a.id ? busy.action : null} rowError={rowErr?.id === a.id ? rowErr.msg : null} />)}</ul></>}
      <AllowanceFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} childName={childName}
        accounts={editing ? allAccounts.filter((a) => a.currency === editing.amount.currency) : accounts}
        initial={editing} onSubmit={submit} pending={formMutation.isPending} error={formMutation.isError ? apiErrorText(formMutation.error, t) : null} t={t} />
      <AllowanceConfirm target={confirm?.a ?? null} action={confirm?.action ?? null} onOpenChange={(o) => { if (!o) { setConfirm(null); status.reset(); retry.reset(); } }}
        onConfirm={() => { if (!confirm) return; if (confirm.action === 'retry') runRetry(confirm.a); else runStatus(confirm.a, 'cancel'); }}
        pending={status.isPending || retry.isPending}
        error={status.isError ? apiErrorText(status.error, t) : retry.isError ? apiErrorText(retry.error, t) : null} t={t} />
    </section>
  );
}
