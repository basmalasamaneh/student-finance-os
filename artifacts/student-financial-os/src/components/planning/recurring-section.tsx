import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeleteRecurringExpense, useUpdateRecurringExpense, type RecurringExpense } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MoneyDisplay } from '@/components/finance/money-display';
import { SectionHeading } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY, FREQUENCY, formatUtcDate, lbl, planErrorText, useRefreshPlan } from '@/features/planning/planning-model';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RecurringDialog } from './recurring-dialog';
import { ConfirmDelete, EmptyRow, RowActions } from './plan-shared';

export function RecurringSection({ items, t }: { items: RecurringExpense[]; t: Tx }) {
  const { locale } = useI18n();
  const { toast } = useToast();
  const [editing, setEditing] = useState<RecurringExpense | undefined>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null);
  const del = useDeleteRecurringExpense();
  const toggle = useUpdateRecurringExpense();
  const refresh = useRefreshPlan();

  function setActive(r: RecurringExpense, active: boolean) {
    const { id, ...rest } = r;
    toggle.mutate({ id, data: { ...rest, active } }, {
      onSuccess: () => void refresh(),
      onError: (e) => toast({ variant: 'destructive', title: t('Not updated', 'لم يُحدَّث'), description: planErrorText(e, t) }),
    });
  }

  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="recurring-title" data-testid="section-recurring">
      <SectionHeading id="recurring-title" title={t('Recurring expenses', 'المصاريف المتكررة')} meta={t('Normalized to monthly', 'محوّلة إلى شهري')}
        trailing={<Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-recurring"><Plus aria-hidden />{t('Recurring', 'متكرر')}</Button>} />
      {items.length === 0 ? (
        <EmptyRow title={t('No recurring expenses', 'لا مصاريف متكررة')} body={t('Add rent-like or subscription costs with their next date. They show as upcoming, never as charges.', 'أضف تكاليف متكررة مع تاريخها القادم. تظهر كقادمة ولا تُخصم.')}
          action={<Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-recurring-empty">{t('Add recurring expense', 'أضف مصروفاً متكرراً')}</Button>} />
      ) : (
        <ul className="divide-y divide-divider">
          {items.map((r) => (
            <li key={r.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5', !r.active && 'opacity-60')} data-testid={`row-recurring-${r.id}`}>
              <div className="min-w-0 flex-1">
                <p className="type-label break-words">{r.description || lbl(CATEGORY, r.category, t)}</p>
                <p className="type-caption text-muted-foreground">{lbl(CATEGORY, r.category, t)} · {lbl(FREQUENCY, r.frequency, t)} · {t('next', 'القادم')} {formatUtcDate(r.nextDate, locale)}</p>
              </div>
              <MoneyDisplay value={r.amount} size="sm" tone="planned" />
              <Switch checked={r.active} disabled={toggle.isPending} onCheckedChange={(v) => setActive(r, v)} aria-label={t('Active', 'نشط')} data-testid={`switch-recurring-active-${r.id}`} />
              <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setDeleting(r)} t={t} testId={`recurring-${r.id}`} />
            </li>
          ))}
        </ul>
      )}
      <RecurringDialog open={open} onOpenChange={setOpen} item={editing} t={t} />
      <ConfirmDelete open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} t={t}
        title={t('Delete this recurring expense?', 'حذف هذا المصروف المتكرر؟')}
        body={t('It will leave the plan and upcoming list. No ledger entries are affected.', 'سيُزال من الخطة والقائمة القادمة. لا تتأثر أي قيود في السجل.')}
        onConfirm={async () => { if (deleting) { await del.mutateAsync({ id: deleting.id }); await refresh(); } }} />
    </section>
  );
}
