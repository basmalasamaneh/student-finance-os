import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Lock } from 'lucide-react';
import type { FamilyDecision, Amount, ParentChild } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { StatePanel } from '@/components/states/state-panel';
import { Field, inputClass } from '@/components/money/fields';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useDeviceSecurity } from '@/features/security/device-security';
import { formatDate } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { isLive } from '@/components/requests/request-view-model';
import { ALLOWANCE_STATUS, day, FREQUENCY_TEXT, grantedCount, UPCOMING_SOURCE } from '@/features/family/family-view';

/** Parent: enter the private code, then accept or decline. Code lives in component memory only. */
export function AcceptCodeDialog({ open, onOpenChange, onDecide, pending, error, result, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; onDecide: (token: string, action: 'accept' | 'decline') => void;
  pending?: 'accept' | 'decline' | null; error?: string | null; result?: FamilyDecision | null; t: Tx;
}) {
  const [code, setCode] = useState('');
  useEffect(() => { if (open) setCode(''); }, [open]);
  const trimmed = code.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent data-testid="dialog-accept-code">
        <DialogHeader>
          <DialogTitle>{result ? (result.status === 'accepted' ? t('Connected', 'تم الاتصال') : t('Invitation declined', 'تم رفض الدعوة')) : t('Connect with your child', 'الاتصال بابنك/ابنتك')}</DialogTitle>
          <DialogDescription>{result
            ? (result.status === 'accepted' ? t(`You can now see what ${result.childName ?? 'your child'} chose to share.`, `يمكنك الآن رؤية ما اختار ${result.childName ?? 'ابنك'} مشاركته.`) : t('Nothing was shared.', 'لم تتم مشاركة شيء.'))
            : t('Enter the private code they shared. You’ll only see what they allow.', 'أدخل الرمز الخاص الذي شاركه. سترى فقط ما يسمح به.')}</DialogDescription>
        </DialogHeader>
        {!result ? (
          <Field id="family-code" label={t('Private code', 'الرمز الخاص')} error={error ?? undefined}>
            <input id="family-code" dir="ltr" autoComplete="off" autoCapitalize="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)}
              className={inputClass + ' tabular'} aria-invalid={!!error} data-testid="input-family-code" />
          </Field>
        ) : null}
        <DialogFooter>
          {result ? <Button onClick={() => onOpenChange(false)} data-testid="button-done-accept">{t('Done', 'تم')}</Button> : <>
            <Button variant="secondary" disabled={!trimmed || !!pending} loading={pending === 'decline'} onClick={() => onDecide(trimmed, 'decline')} data-testid="button-decline-code">{t('Decline', 'رفض')}</Button>
            <Button disabled={!trimmed || !!pending} loading={pending === 'accept'} onClick={() => onDecide(trimmed, 'accept')} data-testid="button-accept-code">{t('Accept', 'قبول')}</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Amounts({ label, values, testId }: { label: string; values?: Amount[]; testId: string }) {
  const { hideBalances: hb } = useDeviceSecurity();
  if (!values) return null;
  return <div className="flex min-w-0 flex-col gap-1"><span className="type-caption text-muted-foreground">{label}</span>
    {values.length ? <div className="flex flex-col gap-0.5" data-testid={testId}>{values.map((v) => <MoneyDisplay hidden={hb} key={v.currency} value={v} size="sm" />)}</div>
      : <span className="type-caption text-muted-foreground" data-testid={testId}>{label === '' ? '' : '—'}</span>}</div>;
}

/** Renders ONLY sections the server returned. Omitted = not shared, never zero. */
export function ChildSummaryCard({ child, t, detailed = false }: { child: ParentChild; t: Tx; detailed?: boolean }) {
  const { locale } = useI18n();
  const { hideBalances: hb } = useDeviceSecurity();
  const hidden = 8 - grantedCount(child.permissions);
  const limit = detailed ? 50 : 5;
  return (
    <Card className="flex flex-col gap-5 p-5" data-testid={`card-child-${child.childId}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-title truncate">{child.name}</h3>
        {!detailed ? <Link href={`/parent/children/${child.childId}`} className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid={`link-child-${child.childId}`}>{t('Details', 'التفاصيل')}</Link> : null}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Amounts label={t('Available balance', 'الرصيد المتاح')} values={child.balance} testId={`text-child-balance-${child.childId}`} />
        <Amounts label={t('Received this month', 'المستلم هذا الشهر')} values={child.income} testId={`text-child-income-${child.childId}`} />
        <Amounts label={t('Campus spending', 'الإنفاق الجامعي')} values={child.campusSpending} testId={`text-child-campus-${child.childId}`} />
      </div>
      {child.monthlySummary?.length ? <div className="flex flex-col gap-2">
        <span className="type-caption text-muted-foreground">{t('This month', 'هذا الشهر')}</span>
        {child.monthlySummary.map((m) => <div key={m.currency} className="flex flex-wrap items-center justify-between gap-2 type-label">
          <span className="flex items-center gap-1">{t('In', 'داخل')} <MoneyDisplay hidden={hb} value={m.income} size="sm" tone="positive" /></span>
          <span className="flex items-center gap-1">{t('Out', 'خارج')} <MoneyDisplay hidden={hb} value={m.spending} size="sm" /></span>
          <span className="type-caption text-muted-foreground">{m.campusIncluded ? t('Includes campus', 'يشمل الحرم') : t('Campus excluded', 'دون الحرم')}</span>
        </div>)}
      </div> : null}
      {child.goals ? <div className="flex flex-col gap-2"><span className="type-caption text-muted-foreground">{t('Goals (view only)', 'الأهداف (عرض فقط)')}</span>
        {child.goals.length ? <ul className="flex flex-col gap-2">{child.goals.slice(0, limit).map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 type-label"><span className="truncate">{g.name}</span>
            <span className="flex items-center gap-1"><MoneyDisplay hidden={hb} value={g.current} size="sm" /><span className="text-muted-foreground">/</span><MoneyDisplay hidden={hb} value={g.target} size="sm" tone="muted" /></span></li>))}</ul>
          : <span className="type-caption text-muted-foreground">{t('No goals yet', 'لا أهداف بعد')}</span>}
        <p className="type-caption text-muted-foreground">{t('Seeing goals doesn’t allow funding. To add to a goal, your child must send a goal invitation — use Fund a goal.', 'رؤية الأهداف لا تسمح بالتمويل. لإضافة مال لهدف، يجب أن يرسل ابنك دعوة هدف — استخدم تمويل هدف.')}</p>
      </div> : null}
      {child.allowances ? <div className="flex flex-col gap-2"><span className="type-caption text-muted-foreground">{t('Your allowances', 'مصروفاتك')}</span>
        {child.allowances.length ? <ul className="flex flex-col gap-2">{child.allowances.slice(0, limit).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 type-label"><span className="flex items-center gap-2 truncate">{a.frequency ? t(...FREQUENCY_TEXT[a.frequency]) : t('One-time', 'مرة واحدة')}<StatusBadge tone={ALLOWANCE_STATUS[a.status].tone} label={t(...ALLOWANCE_STATUS[a.status].text)} /></span>
            <MoneyDisplay hidden={hb} value={a.amount} size="sm" /></li>))}</ul>
          : <span className="type-caption text-muted-foreground">{t('No allowances yet', 'لا مصروفات بعد')}</span>}
      </div> : null}
      {child.upcomingPayments ? <div className="flex flex-col gap-2"><span className="type-caption text-muted-foreground">{t('Upcoming', 'القادم')}</span>
        {child.upcomingPayments.length ? <ul className="flex flex-col gap-2">{child.upcomingPayments.slice(0, limit).map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 type-label"><span className="truncate">{t(...(UPCOMING_SOURCE[u.source] ?? ['Item', 'بند']))} · <span className="text-muted-foreground">{formatDate(day(u.date), locale)}</span></span>
            <MoneyDisplay hidden={hb} value={u.amount} size="sm" tone="planned" /></li>))}</ul>
          : <span className="type-caption text-muted-foreground">{t('Nothing upcoming', 'لا شيء قادم')}</span>}
      </div> : null}
      {child.transactions ? <div className="flex flex-col gap-1"><span className="type-caption text-muted-foreground">{t('Recent activity', 'النشاط الأخير')}</span>
        {child.transactions.length ? <ul className="divide-y divide-divider">{child.transactions.slice(0, limit).map((a) => (
          <li key={a.id} className="flex min-h-11 items-center justify-between gap-3 py-2 type-label" data-testid={`row-child-activity-${a.id}`}><span className="truncate capitalize">{a.type.replace(/_/g, ' ')} · <span className="text-muted-foreground">{formatDate(new Date(a.createdAt), locale)}</span></span>
            <MoneyDisplay hidden={hb} value={a.amount} size="sm" tone={a.direction === 'credit' ? 'positive' : 'default'} showPlus={a.direction === 'credit'} /></li>))}</ul>
          : <span className="type-caption text-muted-foreground">{t('No activity yet', 'لا نشاط بعد')}</span>}
      </div> : null}
      {child.requests ? (() => { const open = child.requests.items.filter(isLive).length; return (
        <Link href="/parent/requests" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid={`link-child-requests-${child.childId}`}>
          {open ? t(`${open} open request${open === 1 ? '' : 's'} · review`, `${open} طلبات مفتوحة · مراجعة`) : t(`Requests · ${child.requests.items.length} total, none open`, `الطلبات · ${child.requests.items.length} إجمالاً، لا شيء مفتوح`)}
        </Link>); })() : null}
      {hidden > 0 ? <p className="type-caption flex items-center gap-1.5 text-muted-foreground"><Lock className="size-3.5" aria-hidden />
        {t(`${hidden} of 8 areas not shared`, `${hidden} من 8 مجالات غير مشتركة`)}</p> : null}
    </Card>
  );
}

export function NoChildren({ onConnect, t }: { onConnect: () => void; t: Tx }) {
  return <StatePanel tone="empty" title={t('No children connected yet', 'لا أبناء متصلون بعد')}
    body={t('Ask your child to invite you from their Family page, then enter the private code.', 'اطلب من ابنك دعوتك من صفحة العائلة ثم أدخل الرمز الخاص.')}
    action={<Button onClick={onConnect} data-testid="button-connect-child-empty">{t('Enter a code', 'إدخال رمز')}</Button>} />;
}
