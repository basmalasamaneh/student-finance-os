import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeletePlanLine, type PlanLine } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { SectionHeading } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY, formatUtcDate, lbl, LINE_TYPE, useRefreshPlan } from '@/features/planning/planning-model';
import { LineDialog } from './line-dialog';
import { ConfirmDelete, EmptyRow, RowActions } from './plan-shared';

export function LinesSection({ lines, t }: { lines: PlanLine[]; t: Tx }) {
  const { locale } = useI18n();
  const [editing, setEditing] = useState<PlanLine | undefined>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<PlanLine | null>(null);
  const del = useDeletePlanLine();
  const refresh = useRefreshPlan();
  const order = ['fixed', 'variable', 'savings'] as const;

  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="lines-title" data-testid="section-lines">
      <SectionHeading id="lines-title" title={t('Monthly plan lines', 'بنود الخطة الشهرية')} meta={t('Fixed · variable · savings', 'ثابت · متغير · ادخار')}
        trailing={<Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-line"><Plus aria-hidden />{t('Line', 'بند')}</Button>} />
      {lines.length === 0 ? (
        <EmptyRow title={t('No manual lines', 'لا بنود يدوية')} body={t('Add tuition, cafeteria, printing or a savings target as a monthly estimate.', 'أضف الرسوم أو الكافتيريا أو الطباعة أو هدف ادخار كتقدير شهري.')}
          action={<Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-line-empty">{t('Add first line', 'أضف أول بند')}</Button>} />
      ) : order.map((ty) => {
        const items = lines.filter((l) => l.type === ty);
        if (!items.length) return null;
        return (
          <div key={ty} className="pb-2">
            <h3 className="type-caption pt-2 font-medium uppercase tracking-wide text-gold-ink">{lbl(LINE_TYPE, ty, t)}</h3>
            <ul className="divide-y divide-divider">
              {items.map((l) => (
                <li key={l.id} className="flex items-center gap-4 py-3.5" data-testid={`row-line-${l.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="type-label break-words">{l.description || lbl(CATEGORY, l.category, t)}</p>
                    <p className="type-caption text-muted-foreground">{lbl(CATEGORY, l.category, t)}{l.upcomingDate ? ` · ${formatUtcDate(l.upcomingDate, locale)}` : ''}</p>
                  </div>
                  <MoneyDisplay value={l.amount} size="sm" tone="planned" />
                  <RowActions onEdit={() => { setEditing(l); setOpen(true); }} onDelete={() => setDeleting(l)} t={t} testId={`line-${l.id}`} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <LineDialog open={open} onOpenChange={setOpen} line={editing} t={t} />
      <ConfirmDelete open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} t={t}
        title={t('Delete this plan line?', 'حذف هذا البند؟')}
        body={t('The category falls back to recurring entries or your profile baseline.', 'ستعود الفئة إلى المصاريف المتكررة أو أساس ملفك.')}
        onConfirm={async () => { if (deleting) { await del.mutateAsync({ id: deleting.id }); await refresh(); } }} />
    </section>
  );
}
