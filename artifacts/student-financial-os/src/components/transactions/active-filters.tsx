import { X } from 'lucide-react';
import type { FinanceHistoryFilterOptions } from '@workspace/api-client-react';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { shortId } from '@/features/money/money-model';
import type { HistoryFilters } from '@/features/transactions/history-filters';
import { categoryLabel, typeLabel } from '@/features/transactions/labels';

type Chip = { key: string; text: string; clear: Partial<HistoryFilters> };

/** Removable chips for every applied filter so the current query is always visible. */
export function ActiveFilters({ f, options, onChange, onClearAll, t }: { f: HistoryFilters; options?: FinanceHistoryFilterOptions; onChange: (patch: Partial<HistoryFilters>) => void; onClearAll: () => void; t: Tx }) {
  const { lang } = useI18n();
  const chips: Chip[] = [];
  if (f.search) chips.push({ key: 'search', text: `"${f.search}"`, clear: { search: '' } });
  if (f.type) chips.push({ key: 'type', text: typeLabel(f.type, t), clear: { type: '' } });
  if (f.category) chips.push({ key: 'category', text: categoryLabel(f.category, options?.categories, t, lang), clear: { category: '' } });
  if (f.accountId) chips.push({ key: 'account', text: options?.accounts.find((a) => a.id === f.accountId)?.name ?? `${t('Account', 'الحساب')} ${shortId(f.accountId)}`, clear: { accountId: '' } });
  if (f.dateFrom || f.dateTo) chips.push({ key: 'date', text: `${f.dateFrom || '…'} → ${f.dateTo || '…'}`, clear: { dateFrom: '', dateTo: '' } });
  if (f.amountMin || f.amountMax) chips.push({ key: 'amount', text: `${f.amountCurrency} ${f.amountMin || '0'} – ${f.amountMax || '∞'}`, clear: { amountMin: '', amountMax: '' } });
  if (f.universityId) { const u = options?.universities.find((x) => x.id === f.universityId); chips.push({ key: 'uni', text: u ? (lang === 'ar' ? u.arabicName : u.name) : `${t('University', 'الجامعة')} ${shortId(f.universityId)}`, clear: { universityId: '', campusId: '' } }); }
  if (f.campusId) { const c = options?.campuses.find((x) => x.id === f.campusId); chips.push({ key: 'campus', text: c ? (lang === 'ar' ? c.arabicName : c.name) : `${t('Campus', 'الحرم')} ${shortId(f.campusId)}`, clear: { campusId: '' } }); }
  if (f.parentTransferId) chips.push({ key: 'pt', text: `${t('Parent transfer', 'تحويل الأهل')} ${shortId(f.parentTransferId)}`, clear: { parentTransferId: '' } });
  if (f.goalId) chips.push({ key: 'goal', text: `${t('Goal', 'الهدف')} ${shortId(f.goalId)}`, clear: { goalId: '' } });
  if (!chips.length) return null;
  return (
    <div className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" aria-label={t('Applied filters', 'المرشحات المطبقة')} role="group" data-testid="group-active-filters">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={() => onChange(c.clear)} className="type-caption shrink-0 snap-start inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft ps-3 pe-2 font-medium text-foreground transition-colors hover:border-primary sm:min-h-9"
          aria-label={`${t('Remove filter', 'إزالة المرشح')}: ${c.text}`} data-testid={`chip-${c.key}`}>
          <bdi className="max-w-[14rem] truncate">{c.text}</bdi><X className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="type-label inline-flex min-h-11 shrink-0 items-center px-2 text-gold-ink underline-offset-4 hover:underline" data-testid="button-clear-all">{t('Clear all', 'مسح الكل')}</button>
    </div>
  );
}
