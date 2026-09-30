import { useEffect, useId, useState, type ReactNode } from 'react';
import type { FinanceHistoryFilterOptions } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { EMPTY_FILTERS, HISTORY_CURRENCIES, SEMANTIC_TYPES, buildParams, type FilterError, type HistoryCurrency, type HistoryFilters } from '@/features/transactions/history-filters';
import { GROUP_LABEL, typeLabel } from '@/features/transactions/labels';
import { label } from '@/features/money/money-model';

const control = 'min-h-11 min-w-0 w-full max-w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive';

function Field({ label: text, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 break-words">
      <label htmlFor={htmlFor} className="type-label">{text}</label>
      {children}
      {error ? <p id={`${htmlFor}-err`} role="alert" className="type-caption text-destructive">{error}</p> : hint ? <p id={`${htmlFor}-hint`} className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function amountReasonText(reason: string | undefined, currency: HistoryCurrency, t: Tx) {
  if (reason === 'precision') return currency === 'JOD' ? t('JOD allows up to 3 decimal places.', 'الدينار يسمح بثلاث خانات عشرية.') : t('Up to 2 decimal places.', 'خانتان عشريتان كحد أقصى.');
  if (reason === 'range') return t('That amount is too large.', 'المبلغ كبير جداً.');
  return t('Use digits only, like 12.50.', 'استخدم الأرقام فقط، مثل 12.50.');
}

export function FilterPanel({ open, onOpenChange, value, onApply, options, optionsState, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; value: HistoryFilters; onApply: (f: HistoryFilters) => void;
  options?: FinanceHistoryFilterOptions; optionsState: 'loading' | 'error' | 'ready'; t: Tx;
}) {
  const { lang, dir } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const set = (k: keyof HistoryFilters, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const built = buildParams(draft);
  const has = (e: FilterError) => built.errors.includes(e);
  const opt = options;
  const loadingText = optionsState === 'loading' ? t('Loading options…', 'جارٍ تحميل الخيارات…') : optionsState === 'error' ? t('Options did not load. Close and reopen Filters to retry.', 'تعذّر تحميل الخيارات. أغلق المرشحات وافتحها مجدداً لإعادة المحاولة.') : undefined;
  const campuses = (opt?.campuses ?? []).filter((c) => !draft.universityId || c.universityId === draft.universityId);
  const groups = ['university', 'school', 'campus', 'legacy'] as const;

  const apply = () => { if (built.errors.length) return; onApply({ ...draft, search: value.search, page: 1 }); onOpenChange(false); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={dir === 'rtl' ? 'left' : 'right'} className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md" data-testid="sheet-filters">
        <SheetHeader className="border-b border-divider px-5 py-4 text-start">
          <SheetTitle>{t('Filter history', 'تصفية السجل')}</SheetTitle>
          <SheetDescription>{t('Filters combine. Results come from the server across your full history, not just this page.', 'تُدمج المرشحات معاً. النتائج من الخادم عبر سجلك الكامل، لا هذه الصفحة فقط.')}</SheetDescription>
        </SheetHeader>
        <form id={`${id}-form`} className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 [&_fieldset]:min-w-0" onSubmit={(e) => { e.preventDefault(); apply(); }}>
          <Field label={t('Type', 'النوع')} htmlFor={`${id}-type`}>
            <select id={`${id}-type`} className={control} value={draft.type} onChange={(e) => set('type', e.target.value)} data-testid="select-type">
              <option value="">{t('All types', 'كل الأنواع')}</option>
              {SEMANTIC_TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty, t)}</option>)}
            </select>
          </Field>

          <Field label={t('Category', 'الفئة')} htmlFor={`${id}-cat`} hint={loadingText ?? t('Grouped by University, School and Campus. Earlier Prompt 4 entries keep their original category.', 'مجمّعة حسب الجامعة والمدرسة والحرم. تحتفظ القيود السابقة بفئتها الأصلية.')}>
            <select id={`${id}-cat`} className={control} value={draft.category} onChange={(e) => set('category', e.target.value)} disabled={optionsState !== 'ready'} data-testid="select-category">
              <option value="">{t('All categories', 'كل الفئات')}</option>
              {groups.map((g) => {
                const items = (opt?.categories ?? []).filter((c) => c.group === g);
                return items.length ? <optgroup key={g} label={label(GROUP_LABEL, g, t)}>{items.map((c) => <option key={`${g}-${c.key}`} value={c.key}>{lang === 'ar' ? c.arabicLabel : c.label}</option>)}</optgroup> : null;
              })}
            </select>
          </Field>

          <Field label={t('Account', 'الحساب')} htmlFor={`${id}-acct`} hint={loadingText ?? (!opt?.accounts.length ? t('You have no accounts yet.', 'لا توجد حسابات بعد.') : undefined)}>
            <select id={`${id}-acct`} className={control} value={draft.accountId} onChange={(e) => set('accountId', e.target.value)} disabled={optionsState !== 'ready' || !opt?.accounts.length} data-testid="select-account">
              <option value="">{t('All accounts', 'كل الحسابات')}</option>
              {(opt?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="type-label pb-1.5">{t('Date range', 'نطاق التاريخ')}</legend>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <Field label={t('From', 'من')} htmlFor={`${id}-from`} error={has('dateFrom') ? t('Enter a valid date.', 'أدخل تاريخاً صحيحاً.') : undefined}>
                <input id={`${id}-from`} type="date" className={control} value={draft.dateFrom} max={draft.dateTo || undefined} onChange={(e) => set('dateFrom', e.target.value)} aria-invalid={has('dateFrom') || has('dateOrder')} data-testid="input-date-from" />
              </Field>
              <Field label={t('To', 'إلى')} htmlFor={`${id}-to`} error={has('dateTo') ? t('Enter a valid date.', 'أدخل تاريخاً صحيحاً.') : undefined}>
                <input id={`${id}-to`} type="date" className={control} value={draft.dateTo} min={draft.dateFrom || undefined} onChange={(e) => set('dateTo', e.target.value)} aria-invalid={has('dateTo') || has('dateOrder')} data-testid="input-date-to" />
              </Field>
            </div>
            {has('dateOrder') ? <p role="alert" className="type-caption text-destructive">{t('"From" must be on or before "To".', 'يجب أن يكون "من" قبل "إلى" أو مساوياً له.')}</p>
              : <p className="type-caption text-muted-foreground">{t('Both days are included. Days follow UTC, so late-night entries may fall on the next day.', 'اليومان مشمولان. الأيام بتوقيت UTC، فقد تقع قيود آخر الليل في اليوم التالي.')}</p>}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="type-label pb-1.5">{t('Amount', 'المبلغ')}</legend>
            <Field label={t('Currency', 'العملة')} htmlFor={`${id}-cur`}>
              <select id={`${id}-cur`} className={control} value={draft.amountCurrency} onChange={(e) => set('amountCurrency', e.target.value as HistoryCurrency)} data-testid="select-amount-currency">
                {HISTORY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <Field label={t('Minimum', 'الحد الأدنى')} htmlFor={`${id}-min`} error={has('amountMin') ? amountReasonText(built.amountReasons.amountMin, draft.amountCurrency, t) : undefined}>
                <input id={`${id}-min`} inputMode="decimal" dir="ltr" className={`${control} tabular`} placeholder="0.00" value={draft.amountMin} onChange={(e) => set('amountMin', e.target.value)} aria-invalid={has('amountMin') || has('amountOrder')} data-testid="input-amount-min" />
              </Field>
              <Field label={t('Maximum', 'الحد الأقصى')} htmlFor={`${id}-max`} error={has('amountMax') ? amountReasonText(built.amountReasons.amountMax, draft.amountCurrency, t) : undefined}>
                <input id={`${id}-max`} inputMode="decimal" dir="ltr" className={`${control} tabular`} placeholder="0.00" value={draft.amountMax} onChange={(e) => set('amountMax', e.target.value)} aria-invalid={has('amountMax') || has('amountOrder')} data-testid="input-amount-max" />
              </Field>
            </div>
            {has('amountOrder') ? <p role="alert" className="type-caption text-destructive">{t('Minimum must not exceed maximum.', 'يجب ألا يتجاوز الحد الأدنى الحد الأقصى.')}</p>
              : <p className="type-caption text-muted-foreground">{t('Only entries in the chosen currency match. Currencies are never converted.', 'تطابق فقط القيود بالعملة المختارة. لا تُحوَّل العملات.')}</p>}
          </fieldset>

          <Field label={t('University', 'الجامعة')} htmlFor={`${id}-uni`} hint={loadingText ?? (!opt?.universities.length ? t('Appears after your first campus payment.', 'تظهر بعد أول دفعة جامعية.') : undefined)}>
            <select id={`${id}-uni`} className={control} value={draft.universityId} onChange={(e) => setDraft((d) => ({ ...d, universityId: e.target.value, campusId: '' }))} disabled={optionsState !== 'ready' || !opt?.universities.length} data-testid="select-university">
              <option value="">{t('All universities', 'كل الجامعات')}</option>
              {(opt?.universities ?? []).map((u) => <option key={u.id} value={u.id}>{lang === 'ar' ? u.arabicName : u.name}</option>)}
            </select>
          </Field>
          <Field label={t('Campus', 'الحرم')} htmlFor={`${id}-campus`} hint={loadingText ?? (!opt?.campuses.length ? t('Only campuses from your own payment history are listed.', 'تُعرض فقط الحُرُم من سجل مدفوعاتك.') : undefined)}>
            <select id={`${id}-campus`} className={control} value={draft.campusId} onChange={(e) => set('campusId', e.target.value)} disabled={optionsState !== 'ready' || !campuses.length} data-testid="select-campus">
              <option value="">{t('All campuses', 'كل الحُرُم')}</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.arabicName : c.name}</option>)}
            </select>
          </Field>

          <div className="flex flex-col gap-5 border-t border-divider pt-5">
            <p className="type-caption text-muted-foreground">{t('Filter by one of your savings goals. Parent transfers arrive in a later release, so that filter currently returns no results.', 'صفِّ حسب أحد أهداف ادخارك. تحويلات الأهل تصل في إصدار لاحق، لذا يعيد ذلك المرشح حالياً لا نتائج.')}</p>
            <Field label={t('Parent transfer ID', 'معرّف تحويل الأهل')} htmlFor={`${id}-pt`} error={has('parentTransferId') ? t('Enter a full ID (UUID).', 'أدخل معرّفاً كاملاً (UUID).') : undefined} hint={t('Optional · not yet available', 'اختياري · غير متاح بعد')}>
              <input id={`${id}-pt`} dir="ltr" className={`${control} font-mono text-xs`} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={draft.parentTransferId} onChange={(e) => set('parentTransferId', e.target.value)} aria-invalid={has('parentTransferId')} data-testid="input-parent-transfer" />
            </Field>
            <Field label={t('Goal', 'الهدف')} htmlFor={`${id}-goal`} error={has('goalId') ? t('Enter a full ID (UUID).', 'أدخل معرّفاً كاملاً (UUID).') : undefined} hint={(opt?.goals.length ?? 0) ? undefined : t('No goals yet. Create one on the Goals page, or paste an ID.', 'لا أهداف بعد. أنشئ هدفاً في صفحة الأهداف أو الصق معرّفاً.')}>
              {opt?.goals.length ? (
                <select id={`${id}-goal`} className={control} value={draft.goalId} onChange={(e) => set('goalId', e.target.value)} data-testid="select-goal">
                  <option value="">{t('All goals', 'كل الأهداف')}</option>
                  {opt.goals.map((g) => <option key={g} value={g}>{opt.goalOptions?.find((o) => o.id === g)?.name ?? `${g.slice(0, 8)}…`}</option>)}
                </select>
              ) : (
                <input id={`${id}-goal`} dir="ltr" className={`${control} font-mono text-xs`} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={draft.goalId} onChange={(e) => set('goalId', e.target.value)} aria-invalid={has('goalId')} data-testid="input-goal" />
              )}
            </Field>
          </div>
        </form>
        <SheetFooter className="flex-row gap-2 border-t border-divider px-5 py-4 safe-bottom">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => setDraft({ ...EMPTY_FILTERS, search: value.search })} data-testid="button-reset-draft">{t('Reset', 'إعادة ضبط')}</Button>
          <Button type="submit" form={`${id}-form`} variant="gradient" className="flex-[2]" disabled={built.errors.length > 0} data-testid="button-apply-filters">{t('Show results', 'عرض النتائج')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
