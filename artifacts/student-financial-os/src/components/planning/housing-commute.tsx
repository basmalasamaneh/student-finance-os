import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useSavePlanCommuteOverride, type FinancialPlan } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Notice } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { ReviewRow } from '@/components/money/fields';
import { SectionHeading } from '@/components/layout/page';
import type { Currency } from '@/lib/money';
import type { Tx } from '@/features/money/money-model';
import { COMMUTE, lbl, minorToInput, planErrorText, RESIDENCE, useRefreshPlan } from '@/features/planning/planning-model';
import { AmountCurrencyFields, parseAmount } from './plan-shared';

const none = (t: Tx) => <span className="text-muted-foreground">{t('Not set', 'غير محدد')}</span>;

function CommuteOverrideForm({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const o = plan.commuteOverride;
  const baseCur = (o?.amount?.currency ?? plan.commute?.costPerTrip.currency ?? 'ILS') as Currency;
  const [enabled, setEnabled] = useState(!!o?.enabled);
  const [amount, setAmount] = useState(o?.amount ? minorToInput(o.amount.minor, o.amount.currency) : '');
  const [currency, setCurrency] = useState<Currency>(baseCur);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const save = useSavePlanCommuteOverride();
  const refresh = useRefreshPlan();
  const key = `${o?.enabled}-${o?.amount?.minor}-${o?.amount?.currency}`;
  useEffect(() => { setEnabled(!!o?.enabled); setAmount(o?.amount ? minorToInput(o.amount.minor, o.amount.currency) : ''); setCurrency(baseCur); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function submit() {
    if (save.isPending) return;
    setSaved(false);
    let data: { enabled: boolean; amount?: { minor: number; currency: Currency } } = { enabled: false };
    if (enabled) {
      const p = parseAmount(amount, currency, t, true);
      if (!p.amount) { setError(p.error ?? ''); return; }
      data = { enabled: true, amount: p.amount as { minor: number; currency: Currency } };
    }
    setError('');
    save.mutate({ data }, { onSuccess: () => { setSaved(true); void refresh(); } });
  }

  return (
    <form className="flex flex-col gap-3 rounded-xl border border-card-border p-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid="form-commute-override">
      <label className="type-label flex min-h-11 items-center justify-between gap-3">
        <span>{t('Manual monthly commute override', 'تجاوز يدوي لتكلفة التنقل الشهرية')}<span className="type-caption block font-normal text-muted-foreground">{t('Replaces the profile estimate in the plan. Never charges an account.', 'يحلّ محل تقدير الملف في الخطة. لا يخصم من أي حساب.')}</span></span>
        <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); setSaved(false); }} data-testid="switch-commute-override" />
      </label>
      {enabled ? <AmountCurrencyFields idPrefix="commute-override" amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} error={error} t={t} /> : null}
      {save.isError ? <Notice tone="error" title={t('Override not saved', 'لم يُحفظ التجاوز')} body={planErrorText(save.error, t)} /> : null}
      {saved && !save.isError ? <p className="type-caption text-success" role="status">{t('Saved.', 'تم الحفظ.')}</p> : null}
      <div><Button type="submit" size="sm" disabled={save.isPending} aria-busy={save.isPending} data-testid="button-save-commute-override">
        {save.isPending ? <><Loader2 className="animate-spin" aria-hidden />{t('Saving…', 'جارٍ الحفظ…')}</> : save.isError ? t('Retry', 'أعد المحاولة') : t('Save override', 'حفظ التجاوز')}
      </Button></div>
    </form>
  );
}

export function HousingCommuteSection({ plan, t }: { plan: FinancialPlan; t: Tx }) {
  const h = plan.housing;
  const c = plan.commute;
  const profileLink = <Link href="/profile" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-edit-housing-commute">{t('Edit in profile', 'عدّل في الملف')}</Link>;
  return (
    <section className="border-t border-divider py-7 md:py-10" aria-labelledby="hc-title" data-testid="section-housing-commute">
      <SectionHeading id="hc-title" title={t('Housing & commute baseline', 'أساس السكن والتنقل')} meta={t('From your saved profile', 'من ملفك المحفوظ')} trailing={profileLink} />
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
        <div>
          <h3 className="type-subtitle pb-1">{t('Housing', 'السكن')}</h3>
          {h ? (
            <dl className="divide-y divide-divider">
              <ReviewRow label={t('Type', 'النوع')}>{lbl(RESIDENCE, h.type, t)}</ReviewRow>
              <ReviewRow label={t('City', 'المدينة')}><span dir="auto">{h.city || '—'}</span></ReviewRow>
              <ReviewRow label={t('Monthly rent', 'الإيجار الشهري')}>{h.monthlyRent ? <MoneyDisplay value={h.monthlyRent} size="sm" /> : none(t)}</ReviewRow>
              <ReviewRow label={t('Your share (used if set)', 'حصتك (تُستخدم إن وُجدت)')}>{h.studentShare ? <MoneyDisplay value={h.studentShare} size="sm" /> : none(t)}</ReviewRow>
              <ReviewRow label={t('Utilities', 'الخدمات')}>{h.utilities ? <MoneyDisplay value={h.utilities} size="sm" /> : none(t)}</ReviewRow>
              <ReviewRow label={t('Internet', 'الإنترنت')}>{h.internet ? <MoneyDisplay value={h.internet} size="sm" /> : none(t)}</ReviewRow>
              <ReviewRow label={t('Deposit (not monthly)', 'التأمين (ليس شهرياً)')}>{h.deposit ? <MoneyDisplay value={h.deposit} size="sm" tone="muted" /> : none(t)}</ReviewRow>
            </dl>
          ) : <p className="type-caption text-muted-foreground">{t('No housing details saved. Add them in your profile to include rent, utilities and internet.', 'لا تفاصيل سكن محفوظة. أضفها في ملفك لتضمين الإيجار والخدمات والإنترنت.')}</p>}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="type-subtitle pb-1">{t('Commute', 'التنقل')}</h3>
            {c ? (
              <dl className="divide-y divide-divider">
                <ReviewRow label={t('Method', 'الوسيلة')}>{lbl(COMMUTE, c.method, t)}</ReviewRow>
                <ReviewRow label={t('Route', 'المسار')}><span dir="auto">{[c.homeCity, c.university, c.campus].filter(Boolean).join(' → ') || '—'}</span></ReviewRow>
                <ReviewRow label={t('Trips per week', 'الرحلات أسبوعياً')}><span className="tabular">{c.tripsPerWeek}</span>{c.roundTrip ? ` · ${t('round trip', 'ذهاب وإياب')}` : ''}</ReviewRow>
                <ReviewRow label={t('Cost per trip', 'تكلفة الرحلة')}><MoneyDisplay value={c.costPerTrip} size="sm" /></ReviewRow>
                <ReviewRow label={c.manualEstimate ? t('Monthly (manual in profile)', 'شهري (يدوي في الملف)') : t('Estimated monthly', 'التقدير الشهري')}><MoneyDisplay value={c.monthlyEstimate} size="sm" tone="projected" /></ReviewRow>
              </dl>
            ) : <p className="type-caption text-muted-foreground">{t('No commute saved. Add it in your profile, or set a manual override below.', 'لا تنقل محفوظ. أضفه في ملفك أو حدّد تجاوزاً يدوياً أدناه.')}</p>}
          </div>
          <CommuteOverrideForm plan={plan} t={t} />
        </div>
      </div>
    </section>
  );
}
