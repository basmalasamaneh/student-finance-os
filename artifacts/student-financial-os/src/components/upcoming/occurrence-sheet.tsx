import { useState } from 'react';
import { Link } from 'wouter';
import { Ban, CalendarCheck2, CheckCircle2, ExternalLink, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  useDeleteScheduledItem, useSetScheduledOccurrenceStatus, useUpdateScheduledItem,
  type PlanningOccurrence, type ScheduledItem, type ScheduledItemInput, type ScheduledStatus,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { ConfirmDelete } from '@/components/planning/plan-shared';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY, lbl } from '@/features/planning/planning-model';
import { formatDay, KIND, NO_LEDGER, RECURRENCE, SOURCE, sourceLink, STATUS, upcomingErrorText, useRefreshUpcoming } from '@/features/upcoming/upcoming-model';

export const statusTone = (s: string) => (s === 'completed' || s === 'posted' ? 'success' : s === 'cancelled' ? 'neutral' : 'info') as 'success' | 'neutral' | 'info';

function toInput(item: ScheduledItem, status: ScheduledStatus): ScheduledItemInput {
  return {
    name: item.name, amount: item.amount, dueDate: item.dueDate, category: item.category, kind: item.kind, notes: item.notes,
    recurrence: item.recurrence, status, ...(item.endDate ? { endDate: item.endDate } : {}),
  };
}

/** Occurrence detail. "This date" and "Whole series" controls live in visibly separate groups. */
export function OccurrenceSheet({ occ, item, onClose, onEdit, t }: {
  occ: PlanningOccurrence | null; item?: ScheduledItem; onClose: () => void; onEdit: (item: ScheduledItem) => void; t: Tx;
}) {
  const { locale } = useI18n();
  const refresh = useRefreshUpcoming();
  const setOcc = useSetScheduledOccurrenceStatus();
  const updateSeries = useUpdateScheduledItem();
  const del = useDeleteScheduledItem();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);
  const open = !!occ;
  const mutable = occ?.source === 'scheduled_item';
  const repeating = occ ? occ.recurrence !== 'none' : false;
  const busy = setOcc.isPending || updateSeries.isPending;
  const link = occ ? sourceLink(occ.source, t) : null;

  function changeDate(status: ScheduledStatus) {
    if (!occ) return;
    setLastError(null);
    setOcc.mutate({ id: occ.sourceId, date: occ.date, data: { status } }, { onSuccess: () => { void refresh(); onClose(); }, onError: setLastError });
  }
  function changeSeries(status: ScheduledStatus) {
    if (!item) return;
    setLastError(null);
    updateSeries.mutate({ id: item.id, data: toInput(item, status) }, { onSuccess: () => { void refresh(); onClose(); }, onError: setLastError });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { setLastError(null); onClose(); } }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-occurrence">
          {occ ? <>
            <DialogHeader>
              <DialogTitle className="break-words">{occ.name}</DialogTitle>
              <DialogDescription>{formatDay(occ.date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p data-testid="text-occ-amount">
                  <span className="figure-hero">{occ.kind === 'income' ? '+' : '−'}</span>
                  <MoneyDisplay value={occ.amount} size="hero" tone={occ.kind === 'income' ? 'positive' : 'default'} />
                </p>
                <StatusBadge tone={statusTone(occ.status)} label={t(...(STATUS[occ.status] ?? ['', '']))} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 type-label">
                <div><dt className="type-caption text-muted-foreground">{t('Type', 'النوع')}</dt><dd>{lbl(KIND, occ.kind, t)}</dd></div>
                <div><dt className="type-caption text-muted-foreground">{t('Category', 'الفئة')}</dt><dd>{lbl(CATEGORY, occ.category, t)}</dd></div>
                <div><dt className="type-caption text-muted-foreground">{t('Repeats', 'التكرار')}</dt><dd>{lbl(RECURRENCE, occ.recurrence, t)}</dd></div>
                <div><dt className="type-caption text-muted-foreground">{t('Source', 'المصدر')}</dt><dd>{lbl(SOURCE, occ.source, t)}</dd></div>
                <div className="col-span-2"><dt className="type-caption text-muted-foreground">{t('In the forecast', 'ضمن التوقعات')}</dt><dd>{occ.includedInForecast ? t('Included', 'مشمول') : t('Not counted (shown for information)', 'غير محتسب (للعلم فقط)')}</dd></div>
                {item?.notes ? <div className="col-span-2"><dt className="type-caption text-muted-foreground">{t('Notes', 'ملاحظات')}</dt><dd className="whitespace-pre-wrap break-words font-normal">{item.notes}</dd></div> : null}
              </dl>

              {!mutable ? (
                <div className="flex flex-col gap-3 rounded-card border border-dashed border-input p-4" data-testid="panel-readonly-source">
                  <p className="type-label">{t('Read-only here', 'للقراءة فقط هنا')}</p>
                  <p className="type-caption text-muted-foreground">{t('This comes from another part of your plan. Change it where it was created so nothing is duplicated.', 'هذا يأتي من جزء آخر من خطتك. غيّره حيث أُنشئ حتى لا يتكرر شيء.')}</p>
                  {link ? <Link href={link.href} className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-border bg-surface px-4 type-label hover:border-primary" data-testid="link-occ-source"><ExternalLink className="size-4" aria-hidden />{link.label}</Link> : null}
                </div>
              ) : <>
                <section className="flex flex-col gap-3 rounded-card bg-surface-sunken p-4" aria-labelledby="occ-date-h" data-testid="panel-this-date">
                  <div>
                    <h3 id="occ-date-h" className="type-subtitle">{repeating ? t('Only this date', 'هذا التاريخ فقط') : t('This item', 'هذا البند')}</h3>
                    <p className="type-caption text-muted-foreground">{repeating ? t('Other dates in the series stay as they are.', 'تبقى تواريخ السلسلة الأخرى كما هي.') : t('Marks your plan only.', 'يعلّم خطتك فقط.')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {occ.status !== 'completed' ? <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => changeDate('completed')} data-testid="button-occ-complete"><CheckCircle2 aria-hidden />{t('Mark done', 'علّم كمنجز')}</Button> : null}
                    {occ.status !== 'cancelled' ? <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => changeDate('cancelled')} data-testid="button-occ-cancel"><Ban aria-hidden />{t('Skip this date', 'تخطَّ هذا التاريخ')}</Button> : null}
                    {occ.status !== 'planned' ? <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => changeDate('planned')} data-testid="button-occ-reopen"><RotateCcw aria-hidden />{t('Reopen', 'أعد الفتح')}</Button> : null}
                  </div>
                </section>

                {item ? (
                  <section className="flex flex-col gap-3 border-t border-divider pt-4" aria-labelledby="occ-series-h" data-testid="panel-whole-series">
                    <div>
                      <h3 id="occ-series-h" className="type-subtitle">{repeating ? t('Whole series', 'السلسلة كاملة') : t('Item settings', 'إعدادات البند')}</h3>
                      <p className="type-caption text-muted-foreground">{repeating ? t('Affects every date of this repeating item.', 'يؤثر في كل تواريخ هذا البند المتكرر.') : t('Edit or remove the item itself.', 'عدّل البند نفسه أو احذفه.')}</p>
                      {item.status === 'cancelled' ? <p className="type-caption pt-1 text-muted-foreground">{t('The series is cancelled. Reopening one date does not restart it.', 'السلسلة ملغاة. إعادة فتح تاريخ واحد لا يعيد تشغيلها.')}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => onEdit(item)} data-testid="button-series-edit"><Pencil aria-hidden />{repeating ? t('Edit series', 'عدّل السلسلة') : t('Edit', 'تعديل')}</Button>
                      {repeating && item.status !== 'cancelled' ? <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => changeSeries('cancelled')} data-testid="button-series-cancel"><Ban aria-hidden />{t('End series', 'أنهِ السلسلة')}</Button> : null}
                      {item.status === 'cancelled' && repeating ? <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => changeSeries('planned')} data-testid="button-series-resume"><CalendarCheck2 aria-hidden />{t('Restart series', 'أعد تشغيل السلسلة')}</Button> : null}
                      <Button variant="ghost" className="min-h-11 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setConfirmDelete(true)} data-testid="button-series-delete"><Trash2 aria-hidden />{repeating ? t('Delete series', 'احذف السلسلة') : t('Delete', 'حذف')}</Button>
                    </div>
                  </section>
                ) : null}
              </>}

              {busy ? <p className="type-caption inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />{t('Saving…', 'جارٍ الحفظ…')}</p> : null}
              {lastError ? <Notice tone="error" title={t('Not changed', 'لم يتغير')} body={upcomingErrorText(lastError, t)} /> : null}
              <p className="type-caption text-muted-foreground" data-testid="text-no-ledger">{t(...NO_LEDGER)}</p>
            </div>
          </> : null}
        </DialogContent>
      </Dialog>
      {item ? (
        <ConfirmDelete open={confirmDelete} onOpenChange={setConfirmDelete} t={t}
          title={item.recurrence !== 'none' ? t('Delete this whole series?', 'حذف هذه السلسلة كاملة؟') : t('Delete this item?', 'حذف هذا البند؟')}
          body={t('It is removed from your plan, including dates you marked. Your accounts and transaction history are not touched.', 'يُزال من خطتك بما في ذلك التواريخ التي علّمتها. حساباتك وسجل حركاتك لا يتأثران.')}
          onConfirm={async () => { await del.mutateAsync({ id: item.id }); void refresh(); onClose(); }} />
      ) : null}
    </>
  );
}
