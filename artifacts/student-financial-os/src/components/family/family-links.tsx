import { useEffect, useState } from 'react';
import { Check, Copy, Settings2, UserPlus, Users } from 'lucide-react';
import type { FamilyLink, FamilyPermissions, FinanceAccount } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/finance/status-badge';
import { StatePanel } from '@/components/states/state-panel';
import { Field, inputClass } from '@/components/money/fields';
import { PermissionEditor } from '@/components/family/permission-editor';
import { useI18n } from '@/features/i18n/i18n-provider';
import { formatDate } from '@/lib/money';
import { accountName, type Tx } from '@/features/money/money-model';
import { defaultPermissions, grantedCount, LINK_STATUS, linkState, permLabel, PERMISSION_KEYS } from '@/features/family/family-view';
import { cn } from '@/lib/utils';

function ReceivingAccount({ accounts, value, onChange, required, t, id }: { accounts: FinanceAccount[]; value: string; onChange: (v: string) => void; required: boolean; t: Tx; id: string }) {
  return (
    <Field id={id} label={t('Allowance goes into', 'يذهب المصروف إلى')}
      error={required && !value ? t('Choose an account to turn on allowance.', 'اختر حساباً لتفعيل المصروف.') : undefined}
      hint={t('Only you choose this. The parent never sees the account or its balance.', 'أنت فقط تختاره. لا يرى ولي الأمر الحساب أو رصيده.')}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, 'appearance-auto')} data-testid={`select-${id}`}>
        <option value="">{t('No account', 'بلا حساب')}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a, t)} · {a.currency}</option>)}
      </select>
    </Field>
  );
}

/** Student: private invite. Token is shown once from memory only — never stored or put in a URL. */
export function FamilyInviteDialog({ open, onOpenChange, onSubmit, pending, error, token, accounts, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (permissions: FamilyPermissions, receivingAccountId: string | null) => void;
  pending?: boolean; error?: string | null; token?: string | null; accounts: FinanceAccount[]; t: Tx;
}) {
  const [perms, setPerms] = useState<FamilyPermissions>(defaultPermissions);
  const [acct, setAcct] = useState('');
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) { setPerms(defaultPermissions()); setAcct(''); setAck(false); setCopied(false); } }, [open]);
  const copy = async () => { if (!token) return; try { await navigator.clipboard.writeText(token); setCopied(true); } catch { setCopied(false); } };
  const blocked = !ack || (perms.allowance && !acct);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent data-testid="dialog-family-invite" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{token ? t('Share this private code', 'شارك هذا الرمز الخاص') : t('Invite a parent', 'دعوة ولي أمر')}</DialogTitle>
          <DialogDescription>{token
            ? t('Send it privately. It works once, expires in 7 days and is shown only now. No email is sent.', 'أرسله بشكل خاص. يعمل مرة واحدة وينتهي خلال 7 أيام ويظهر الآن فقط. لا يُرسل بريد.')
            : t('They’ll see only what you switch on below.', 'سيرى فقط ما تفعّله أدناه.')}</DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="flex flex-col gap-3">
            <bdi dir="ltr" className="tabular type-label block break-all rounded-[14px] bg-surface-sunken p-4 text-center select-all" data-testid="text-family-code">{token}</bdi>
            <Button variant="secondary" onClick={copy} data-testid="button-copy-family-code">{copied ? <Check /> : <Copy />}{copied ? t('Copied', 'تم النسخ') : t('Copy code', 'نسخ الرمز')}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <PermissionEditor value={perms} onChange={setPerms} t={t} disabled={pending} idPrefix="invite" />
            {perms.allowance ? <ReceivingAccount id="invite-account" accounts={accounts} value={acct} onChange={setAcct} required t={t} /> : null}
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-1" data-testid="checkbox-family-consent" />
              <span className="type-label font-normal">{t('I understand this parent can see the items I switched on until I change or revoke access.', 'أفهم أن ولي الأمر يرى ما فعّلته حتى أغيّر الوصول أو ألغيه.')}</span>
            </label>
            {error ? <p role="alert" className="type-label text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          {token ? <Button onClick={() => onOpenChange(false)} data-testid="button-done-family-invite">{t('Done', 'تم')}</Button> : <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>{t('Cancel', 'إلغاء')}</Button>
            <Button onClick={() => onSubmit(perms, perms.allowance ? acct : (acct || null))} disabled={blocked} loading={pending} data-testid="button-create-family-invite">{t('Create code', 'إنشاء الرمز')}</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditPermissionsDialog({ link, onOpenChange, onSave, pending, error, accounts, t }: {
  link: FamilyLink | null; onOpenChange: (o: boolean) => void; onSave: (permissions: FamilyPermissions, receivingAccountId: string | null) => void;
  pending?: boolean; error?: string | null; accounts: FinanceAccount[]; t: Tx;
}) {
  const [perms, setPerms] = useState<FamilyPermissions>(defaultPermissions);
  const [acct, setAcct] = useState('');
  useEffect(() => { if (link) { setPerms({ ...link.permissions }); setAcct(link.receivingAccountId ?? ''); } }, [link]);
  const droppingAllowance = !!link?.permissions.allowance && !perms.allowance;
  return (
    <Dialog open={!!link} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent data-testid="dialog-edit-permissions" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Edit sharing', 'تعديل المشاركة')}</DialogTitle>
          <DialogDescription>{link?.parentName ?? t('Pending invite', 'دعوة معلّقة')}</DialogDescription>
        </DialogHeader>
        <PermissionEditor value={perms} onChange={setPerms} t={t} disabled={pending} idPrefix="edit" />
        {perms.allowance ? <ReceivingAccount id="edit-account" accounts={accounts} value={acct} onChange={setAcct} required t={t} /> : null}
        {droppingAllowance ? <p className="type-caption rounded-lg bg-warning-soft px-3 py-2 text-warning" data-testid="text-allowance-drop-warning">{t('Turning allowance off cancels this parent’s active and paused schedules. History stays. Turning it back on won’t restart them.', 'إيقاف المصروف يلغي جداول ولي الأمر النشطة والمتوقفة. يبقى السجل. إعادة التفعيل لا تعيدها.')}</p> : null}
        {error ? <p role="alert" className="type-label text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={() => onSave(perms, perms.allowance ? acct : (acct || null))} disabled={perms.allowance && !acct} loading={pending} data-testid="button-save-permissions">{t('Save', 'حفظ')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeLinkConfirm({ link, onOpenChange, onConfirm, pending, error, t }: {
  link: FamilyLink | null; onOpenChange: (o: boolean) => void; onConfirm: () => void; pending?: boolean; error?: string | null; t: Tx;
}) {
  return (
    <AlertDialog open={!!link} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <AlertDialogContent data-testid="dialog-revoke-link">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Stop sharing with this parent?', 'إيقاف المشاركة مع ولي الأمر؟')}</AlertDialogTitle>
          <AlertDialogDescription>{t('This is permanent. They lose access right away and their allowance schedules stop. Money already received stays yours.', 'هذا نهائي. يفقد الوصول فوراً وتتوقف جداول مصروفه. الأموال المستلمة تبقى لك.')}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="type-label text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('Keep sharing', 'متابعة المشاركة')}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-revoke-link"
            onClick={(e) => { e.preventDefault(); onConfirm(); }}>
            {pending ? t('Revoking…', 'جارٍ الإلغاء…') : t('Revoke access', 'إلغاء الوصول')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FamilyLinkList({ links, onInvite, onEdit, onRevoke, t }: {
  links: FamilyLink[]; onInvite: () => void; onEdit: (l: FamilyLink) => void; onRevoke: (l: FamilyLink) => void; t: Tx;
}) {
  const { locale } = useI18n();
  const live = links.filter((l) => { const s = linkState(l); return s === 'pending' || s === 'accepted'; });
  if (!live.length) return <StatePanel tone="empty" icon={<Users className="size-5" />} title={t('No parents connected', 'لا يوجد أولياء أمور')}
    body={t('Invite a parent with a private code. Nothing is shared until you choose.', 'ادعُ ولي أمر برمز خاص. لا شيء يُشارك حتى تختار.')}
    action={<Button onClick={onInvite} data-testid="button-invite-parent-empty"><UserPlus />{t('Invite a parent', 'دعوة ولي أمر')}</Button>} />;
  return (
    <ul className="divide-y divide-divider" data-testid="list-family-links">
      {live.map((l) => {
        const s = linkState(l);
        const on = PERMISSION_KEYS.filter((k) => l.permissions[k]);
        return (
          <li key={l.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-family-link-${l.id}`}>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-subtitle truncate">{l.parentName ?? t('Invite not yet used', 'لم تُستخدم الدعوة بعد')}</span>
                <StatusBadge tone={LINK_STATUS[s].tone} label={t(...LINK_STATUS[s].text)} />
              </div>
              <span className="type-caption text-muted-foreground">
                {on.length ? `${grantedCount(l.permissions)}/8 · ${on.map((k) => permLabel(k, t)).join(' · ')}` : t('Nothing shared', 'لا شيء مشترك')}
                {s === 'pending' ? ` · ${t('Expires', 'تنتهي')} ${formatDate(new Date(l.expiresAt), locale)}` : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onEdit(l)} data-testid={`button-edit-link-${l.id}`}><Settings2 />{t('Edit', 'تعديل')}</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onRevoke(l)} data-testid={`button-revoke-link-${l.id}`}>{t('Revoke', 'إلغاء')}</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
