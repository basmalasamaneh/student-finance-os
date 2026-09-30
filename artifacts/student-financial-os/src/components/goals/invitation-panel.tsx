import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ShieldCheck, UserPlus } from 'lucide-react';
import {
  getListGoalInvitationsQueryKey, useCreateGoalInvitation, useListGoalInvitations, useRevokeGoalInvitation,
  type GoalInvitation, type SavingsGoal,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RetryButton, SkeletonRows } from '@/components/states/state-panel';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { CONSENT_TEXT, fmtDateTime, goalErrorText, GOAL_REFETCH } from '@/features/goals/goals-model';

function invState(i: GoalInvitation): 'revoked' | 'redeemed' | 'expired' | 'pending' {
  if (i.revokedAt) return 'revoked';
  if (i.redeemedAt) return 'redeemed';
  return new Date(i.expiresAt).getTime() < Date.now() ? 'expired' : 'pending';
}

export function InvitationPanel({ goal, t }: { goal: SavingsGoal; t: Tx }) {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const list = useListGoalInvitations(goal.id, { query: { queryKey: getListGoalInvitationsQueryKey(goal.id), ...GOAL_REFETCH } });
  const [consentOpen, setConsentOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<GoalInvitation | null>(null);
  const refresh = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0].startsWith(`/api/goals/${goal.id}/invitations`) || q.queryKey[0].startsWith('/api/parent')) });
  const create = useCreateGoalInvitation();
  const revoke = useRevokeGoalInvitation();
  const canInvite = goal.status === 'active' || goal.status === 'paused';

  const generate = () => {
    if (!ack || create.isPending) return;
    create.mutate({ id: goal.id, data: { limitedConsentAcknowledged: true } }, {
      onSuccess: (r) => { setToken(r.token); setCopied(false); void refresh(); },
    });
  };
  const closeShare = () => { setToken(null); setCopied(false); setAck(false); setConsentOpen(false); create.reset(); };
  const copy = async () => { if (!token) return; try { await navigator.clipboard.writeText(token); setCopied(true); } catch { setCopied(false); } };
  const share = async () => {
    if (!token || !('share' in navigator)) return;
    try { await navigator.share({ text: t(`Student Financial OS goal invitation code (single use, expires in 7 days): ${token}`, `رمز دعوة هدف (استخدام واحد، ينتهي خلال 7 أيام): ${token}`) }); } catch { /* user cancelled */ }
  };

  const rows = list.data ?? [];
  const STATE: Record<ReturnType<typeof invState>, [string, string, string]> = {
    pending: ['Waiting for parent', 'بانتظار ولي الأمر', 'bg-primary-soft text-gold-ink'],
    redeemed: ['Parent has access', 'لدى ولي الأمر وصول', 'bg-success-soft text-success'],
    expired: ['Expired unused', 'انتهت دون استخدام', 'bg-muted text-muted-foreground'],
    revoked: ['Revoked', 'أُلغيت', 'bg-muted text-muted-foreground'],
  };

  return (
    <section aria-labelledby="parent-funding-title" className="flex flex-col gap-3 border-t border-divider py-7" data-testid="section-parent-funding">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="parent-funding-title" className="type-title">{t('Parent funding', 'تمويل الأهل')}</h2>
        {canInvite ? <Button variant="outline" onClick={() => { setAck(false); setConsentOpen(true); }} data-testid="button-invite-parent"><UserPlus aria-hidden />{t('Invite a parent', 'ادعُ ولي أمر')}</Button> : null}
      </div>
      <p className="type-caption max-w-prose text-muted-foreground">{t('You can let one signed-in parent see this goal only and add simulated funds. You can’t record parent funding yourself — it only appears when a parent adds it from their own account.', 'يمكنك السماح لولي أمر مسجّل الدخول برؤية هذا الهدف فقط وإضافة أموال محاكاة. لا يمكنك تسجيل تمويل الأهل بنفسك — يظهر فقط عندما يضيفه ولي الأمر من حسابه.')}</p>
      {list.isPending ? <SkeletonRows rows={2} label={t('Loading invitations…', 'جارٍ تحميل الدعوات…')} />
        : list.isError ? <div className="flex flex-col items-start gap-2"><p role="alert" className="type-label text-destructive">{goalErrorText(list.error, t)}</p><RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={list.isRefetching} onClick={() => list.refetch()} /></div>
          : rows.length ? (
            <ul className="divide-y divide-divider border-y border-divider" data-testid="list-invitations">
              {rows.map((i) => {
                const s = invState(i); const [en, ar, cls] = STATE[s];
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid={`row-invitation-${i.id}`}>
                    <div className="min-w-0">
                      <span className={`type-caption inline-flex rounded-full px-2 py-0.5 font-medium ${cls}`}>{t(en, ar)}</span>
                      <p className="type-caption pt-1 text-muted-foreground"><bdi>{t('Created', 'أُنشئت')} {fmtDateTime(i.createdAt, locale)}</bdi>
                        {s === 'redeemed' && i.redeemedAt ? <> · <bdi>{t('Redeemed', 'استُخدمت')} {fmtDateTime(i.redeemedAt, locale)}</bdi></> : null}
                        {s === 'pending' ? <> · <bdi>{t('Expires', 'تنتهي')} {fmtDateTime(i.expiresAt, locale)}</bdi></> : null}
                        {s === 'revoked' && i.revokedAt ? <> · <bdi>{fmtDateTime(i.revokedAt, locale)}</bdi></> : null}</p>
                    </div>
                    {s === 'pending' || s === 'redeemed' ? <Button variant="ghost" className="min-h-11 text-destructive" onClick={() => setRevokeTarget(i)} data-testid={`button-revoke-${i.id}`}>{s === 'redeemed' ? t('Revoke access', 'إلغاء الوصول') : t('Revoke', 'إلغاء')}</Button> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="type-label text-muted-foreground" data-testid="text-no-invitations">{t('No invitations yet. Nobody else can see this goal.', 'لا دعوات بعد. لا أحد غيرك يرى هذا الهدف.')}</p>}

      <Dialog open={consentOpen} onOpenChange={(o) => { if (!create.isPending) { if (!o) closeShare(); else setConsentOpen(true); } }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-invite">
          <DialogHeader>
            <DialogTitle>{token ? t('Share this code privately', 'شارك هذا الرمز بشكل خاص') : t('Invite a parent to this goal', 'ادعُ ولي أمر إلى هذا الهدف')}</DialogTitle>
            <DialogDescription>{token ? t('Shown once. It is not stored here and won’t be shown again after you close this. No email is sent — give it to your parent yourself.', 'يُعرض مرة واحدة. لا يُحفظ هنا ولن يظهر مجدداً بعد الإغلاق. لا يُرسل بريد — أعطه لولي أمرك بنفسك.') : goal.name}</DialogDescription>
          </DialogHeader>
          {token ? (
            <div className="flex flex-col gap-3">
              <code dir="ltr" className="block select-all break-all rounded-lg bg-surface-sunken p-3 font-mono text-sm" data-testid="text-invitation-token">{token}</code>
              <p className="type-caption text-muted-foreground">{t('Single use · expires in 7 days · your parent must sign into their own parent account and enter it under “Fund a goal”.', 'استخدام واحد · تنتهي خلال 7 أيام · يجب أن يسجّل ولي أمرك الدخول بحساب الأهل ويدخله في «تمويل هدف».')}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void copy()} data-testid="button-copy-token">{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? t('Copied', 'نُسخ') : t('Copy code', 'نسخ الرمز')}</Button>
                {'share' in navigator ? <Button variant="outline" onClick={() => void share()} data-testid="button-share-token">{t('Share…', 'مشاركة…')}</Button> : null}
              </div>
              <span className="sr-only" aria-live="polite">{copied ? t('Code copied', 'نُسخ الرمز') : ''}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-card bg-primary-soft p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />
                <label htmlFor="consent-ack" className="type-label flex items-start gap-3 font-normal">
                  <Checkbox id="consent-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-1" data-testid="checkbox-consent" />
                  <span>{t(CONSENT_TEXT[0], CONSENT_TEXT[1])}</span>
                </label>
              </div>
              <p className="type-caption text-muted-foreground">{t('You can revoke at any time. Revoking stops access immediately; funds already added stay in the goal.', 'يمكنك الإلغاء في أي وقت. الإلغاء يوقف الوصول فوراً؛ الأموال المضافة تبقى في الهدف.')}</p>
              {create.isError ? <p role="alert" className="type-label text-destructive">{goalErrorText(create.error, t)}</p> : null}
            </div>
          )}
          <DialogFooter className="gap-2">
            {token ? <Button onClick={closeShare} data-testid="button-done-share">{t('I’ve shared it — close', 'شاركته — إغلاق')}</Button>
              : <><Button variant="ghost" onClick={closeShare} disabled={create.isPending}>{t('Cancel', 'إلغاء')}</Button>
                <Button onClick={generate} disabled={!ack || create.isPending} data-testid="button-generate-token">{create.isPending ? t('Generating…', 'جارٍ الإنشاء…') : t('Generate code', 'إنشاء الرمز')}</Button></>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => { if (!o && !revoke.isPending) { setRevokeTarget(null); revoke.reset(); } }}>
        <AlertDialogContent data-testid="dialog-revoke">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Revoke parent access?', 'إلغاء وصول ولي الأمر؟')}</AlertDialogTitle>
            <AlertDialogDescription>{t('The code stops working and any parent who redeemed it loses access to this goal right away. Money they already added stays in the goal.', 'يتوقف الرمز عن العمل ويفقد أي ولي أمر استخدمه الوصول فوراً. الأموال التي أضافها تبقى في الهدف.')}</AlertDialogDescription>
          </AlertDialogHeader>
          {revoke.isError ? <p role="alert" className="type-label text-destructive">{goalErrorText(revoke.error, t)}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>{t('Keep', 'إبقاء')}</AlertDialogCancel>
            <AlertDialogAction disabled={revoke.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-revoke"
              onClick={(e) => { e.preventDefault(); if (!revokeTarget) return; revoke.mutate({ id: goal.id, invitationId: revokeTarget.id }, { onSuccess: () => { setRevokeTarget(null); void refresh(); } }); }}>
              {revoke.isPending ? t('Revoking…', 'جارٍ الإلغاء…') : t('Revoke', 'إلغاء')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
