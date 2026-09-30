import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeleteBudget, type Budget } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { SectionHeading } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { barPercent, CATEGORY, formatUtcDate, lbl, useRefreshPlan } from '@/features/planning/planning-model';
import { cn } from '@/lib/utils';
import { BudgetDialog } from './budget-dialog';
import { ConfirmDelete, EmptyRow, RowActions } from './plan-shared';

function BudgetRow({ b, t, onEdit, onDelete }: { b: Budget; t: Tx; onEdit: () => void; onDelete: () => void }) {
  const { locale } = useI18n();
  const over = b.remaining.minor < 0;
  const pct = barPercent(b.actualSpent.minor, b.limit.minor);
  const name = lbl(CATEGORY, b.category, t);
  return (
    <li className="flex flex-col gap-2 py-4" data-testid={`row-budget-${b.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label">{name}</p>
          <p className="type-caption text-muted-foreground">{formatUtcDate(b.periodStart, locale)} – {formatUtcDate(b.periodEnd, locale)} · UTC</p>
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} t={t} testId={`budget-${b.id}`} />
      </div>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t(`${name}: ${pct}% of limit used`, `${name}: استُخدم ${pct}% من الحد`)}
        className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full origin-left rounded-full transition-transform duration-500 rtl:origin-right', over ? 'bg-destructive' : pct >= 85 ? 'bg-warning' : 'bg-primary')} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="type-caption flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-muted-foreground">
        <span><MoneyDisplay value={b.actualSpent} size="sm" testId={`text-budget-actual-${b.id}`} /> {t('spent of', 'مُنفق من')} <MoneyDisplay value={b.limit} size="sm" tone="muted" /></span>
        <span className={cn('font-medium', over ? 'text-destructive' : 'text-foreground')} data-testid={`text-budget-remaining-${b.id}`}>
          {over ? t('Overspent by', 'تجاوز بمقدار') : t('Remaining', 'المتبقي')}{' '}
          <MoneyDisplay value={{ minor: Math.abs(b.remaining.minor), currency: b.remaining.currency }} size="sm" className={over ? '!text-destructive' : ''} />
        </span>
      </div>
    </li>
  );
}

export function BudgetsSection({ budgets, t }: { budgets: Budget[]; t: Tx }) {
  const [editing, setEditing] = useState<Budget | undefined>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const del = useDeleteBudget();
  const refresh = useRefreshPlan();
  const groups = (['weekly', 'monthly'] as const).map((p) => ({ p, items: budgets.filter((b) => b.period === p) }));

  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="budgets-title" data-testid="section-budgets">
      <SectionHeading id="budgets-title" title={t('Budgets', 'الميزانيات')} meta={t('Limits vs. real ledger spending', 'الحدود مقابل الإنفاق الفعلي')}
        trailing={<Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-budget"><Plus aria-hidden />{t('Budget', 'ميزانية')}</Button>} />
      <p className="type-caption max-w-prose pb-3 text-muted-foreground">{t('Actual spent counts debit payments and withdrawals in the current period (sends and transfers excluded). Weekly and monthly budgets are separate comparisons and are never added together. Refreshes every 15 seconds.', 'يُحتسب الإنفاق الفعلي من المدفوعات والسحوبات في الفترة الحالية (دون الإرسال والتحويلات). الميزانيات الأسبوعية والشهرية مقارنات منفصلة ولا تُجمع. يتحدث كل 15 ثانية.')}</p>
      {budgets.length === 0 ? (
        <EmptyRow title={t('No budgets yet', 'لا ميزانيات بعد')} body={t('Set a weekly food limit or a monthly books limit and watch real campus spending fill it.', 'حدّد سقفاً أسبوعياً للطعام أو شهرياً للكتب وشاهد إنفاقك الفعلي يملؤه.')}
          action={<Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-budget-empty">{t('Create first budget', 'أنشئ أول ميزانية')}</Button>} />
      ) : groups.filter((g) => g.items.length).map((g) => (
        <div key={g.p} className="pb-2">
          <h3 className="type-caption pt-2 font-medium uppercase tracking-wide text-gold-ink">{g.p === 'weekly' ? t('Weekly', 'أسبوعي') : t('Monthly', 'شهري')}</h3>
          <ul className="divide-y divide-divider">
            {g.items.map((b) => <BudgetRow key={b.id} b={b} t={t} onEdit={() => { setEditing(b); setOpen(true); }} onDelete={() => setDeleting(b)} />)}
          </ul>
        </div>
      ))}
      <BudgetDialog open={open} onOpenChange={setOpen} budget={editing} t={t} />
      <ConfirmDelete open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} t={t}
        title={t('Delete this budget?', 'حذف هذه الميزانية؟')}
        body={t('Only the limit is removed. Your ledger transactions stay exactly as they are.', 'يُحذف الحد فقط. تبقى حركاتك في السجل كما هي.')}
        onConfirm={async () => { if (deleting) { await del.mutateAsync({ id: deleting.id }); await refresh(); } }} />
    </section>
  );
}
