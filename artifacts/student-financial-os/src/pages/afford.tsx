/**
 * Prompt 13 — "Can I afford this?" (/afford). Contract: POST /api/planning/affordability via the
 * generated plain `compareAffordability` (never the mutation hook — privacy: no MutationCache
 * retention). Scenarios live in component memory only; requests abort on clear/account switch/
 * unmount. Every figure is server-computed and rendered with MoneyDisplay; no verdicts, no
 * approve/deny colours, no goal-delay timelines.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, RotateCcw, Scale, ShoppingBag } from 'lucide-react';
import {
  compareAffordability, useListFinanceAccounts, type AffordabilityRequest,
  type FinanceAccount,
} from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResultArea, letter, type RunState } from '@/components/afford/afford-result';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { accountName, amountErrorText, apiErrorText, parseAmountInput, useTx, type Tx } from '@/features/money/money-model';
import { CATEGORY, EXPENSE_CATEGORIES } from '@/features/planning/planning-model';
import { CURRENCIES, type Currency } from '@/lib/money';
import {
  HORIZONS, MAX_SCENARIOS, addDaysIso, buildRequest, emptyScenario, utcToday, validateScenario,
  type FieldErrors, type Horizon, type ScenarioDraft,
} from '@/features/afford/afford-model';

const ORDINARY: ReadonlySet<string> = new Set(['wallet', 'bank', 'cash', 'other']);

export default function AffordPage() {
  const account = useAccount();
  const t = useTx();
  const { locale } = useI18n();
  const accountsQ = useListFinanceAccounts();
  const accounts = useMemo(() => (accountsQ.data ?? []).filter((a: FinanceAccount) => ORDINARY.has(a.type)), [accountsQ.data]);

  const [horizon, setHorizon] = useState<Horizon>(30);
  const [scenarios, setScenarios] = useState<ScenarioDraft[]>([]);
  const [editing, setEditing] = useState<ScenarioDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<ScenarioDraft | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const seq = useRef(0);
  const epoch = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const invalidate = () => { epoch.current += 1; abortRef.current?.abort(); abortRef.current = null; };
  const dropResult = () => { invalidate(); setRun({ kind: 'idle' }); };

  const resetAll = () => { invalidate(); setScenarios([]); setEditing(null); setRun({ kind: 'idle' }); setHorizon(30); };
  useEffect(() => { resetAll(); }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps -- privacy wipe on account switch
  useEffect(() => () => invalidate(), []);

  const today = utcToday();
  const through = addDaysIso(today, horizon);
  const invalidIds = new Set(scenarios.filter((s) => Object.keys(validateScenario(s, through)).length).map((s) => s.id));

  const execute = async (request: AffordabilityRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const mine = epoch.current;
    setRun({ kind: 'pending', request });
    try {
      const result = await compareAffordability(request, { signal: controller.signal });
      if (mine !== epoch.current) return;
      setRun({ kind: 'done', request, result });
    } catch (e) {
      if (mine !== epoch.current || controller.signal.aborted) return;
      setRun({ kind: 'error', request, message: apiErrorText(e, t) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const compare = () => { const req = buildRequest(scenarios, through); if (req) void execute(req); };
  const rerun = async () => { if (run.kind === 'done' || run.kind === 'error') await execute(run.request); };

  const openAdd = () => {
    seq.current += 1;
    setIsNew(true);
    setEditing(emptyScenario(seq.current, scenarios[0]?.currency ?? (accounts[0]?.currency as Currency | undefined) ?? 'ILS'));
  };
  const saveScenario = (s: ScenarioDraft) => {
    setScenarios((p) => (isNew ? [...p, s] : p.map((x) => (x.id === s.id ? s : x))));
    setEditing(null);
    dropResult();
  };
  const removeScenario = () => {
    if (deleting) setScenarios((p) => p.filter((x) => x.id !== deleting.id));
    setDeleting(null);
    dropResult();
  };
  const changeHorizon = (h: Horizon) => { setHorizon(h); dropResult(); };

  const busy = run.kind === 'pending';
  const canCompare = scenarios.length > 0 && invalidIds.size === 0 && !busy;

  return (
    <Page>
      <PullToRefresh onRefresh={rerun} label={t('Pull to rerun with current data', 'اسحب لإعادة المقارنة ببيانات حالية')}>
        <PageHeader
          eyebrow={t('Explore a purchase', 'استكشف عملية شراء')}
          title={t('Can I afford this?', 'هل أستطيع تحمّل هذا؟')}
          lede={t('Compare up to four purchase options next to your current plan. You decide — this only lays out the numbers.', 'قارن حتى أربعة خيارات شراء إلى جانب خطتك الحالية. القرار لك — هنا الأرقام فقط.')}
        />

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5" data-testid="card-horizon">
              <p className="type-label" id="horizon-label">{t('Look ahead', 'المدى')}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="horizon-label">
                {HORIZONS.map((h) => (
                  <Button key={h} type="button" role="radio" aria-checked={horizon === h} size="sm"
                    variant={horizon === h ? 'default' : 'secondary'} className="min-w-[5.5rem] flex-1" onClick={() => changeHorizon(h)} data-testid={`chip-horizon-${h}`}>
                    {t(`${h} days`, `${h} يوماً`)}
                  </Button>
                ))}
              </div>
              <p className="type-caption text-muted-foreground">{t('Purchase dates must fall within this window.', 'يجب أن تقع تواريخ الشراء ضمن هذه النافذة.')}</p>
            </Card>

            <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5" data-testid="card-scenarios">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-subtitle">{t('Options to compare', 'خيارات للمقارنة')}</p>
                  <p className="type-caption text-muted-foreground">{t(`${scenarios.length} of ${MAX_SCENARIOS} · each compared on its own`, `${scenarios.length} من ${MAX_SCENARIOS} · كل خيار يُقارن وحده`)}</p>
                </div>
                {scenarios.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" disabled={scenarios.length >= MAX_SCENARIOS} onClick={openAdd} data-testid="button-add-scenario">
                    <Plus aria-hidden />{t('Add option', 'إضافة خيار')}
                  </Button>
                ) : null}
              </div>
              {scenarios.length === 0 ? (
                <StatePanel tone="empty" align="center" icon={<ShoppingBag className="size-5" aria-hidden />}
                  title={t('What are you thinking of buying?', 'ما الذي تفكر في شرائه؟')}
                  body={t('Add a purchase, then optionally other options — a different model, a used one, or a later date.', 'أضف عملية شراء، ثم خيارات أخرى إن أردت — طراز مختلف، أو مستعمل، أو تاريخ لاحق.')}
                  action={<Button variant="gradient" onClick={openAdd} data-testid="button-add-purchase"><Plus aria-hidden />{t('Add purchase', 'إضافة عملية شراء')}</Button>} />
              ) : (
                <ul className="flex flex-col divide-y divide-divider">
                  {scenarios.map((s, i) => {
                    const p = parseAmountInput(s.price, s.currency);
                    return (
                      <li key={s.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 py-2" data-testid={`row-scenario-${s.id}`}>
                        <Badge variant="outline" className="shrink-0">{letter(i)}</Badge>
                        <div className="min-w-0">
                          <p className="type-label whitespace-normal [overflow-wrap:anywhere]">{s.item}</p>
                          <p className="type-caption whitespace-normal text-muted-foreground [overflow-wrap:anywhere]">
                            {[s.category ? t(...(CATEGORY[s.category] ?? [s.category, s.category])) : null, s.date || t('Today', 'اليوم'),
                              s.accountId === 'all' ? t('All available', 'كل المتاح') : accountName(accounts.find((a) => a.id === s.accountId), t)].filter(Boolean).join(' · ')}
                          </p>
                          {invalidIds.has(s.id) ? <p className="type-caption text-destructive" data-testid={`error-scenario-${s.id}`}>{t('Date is outside the window — edit this option.', 'التاريخ خارج النافذة — عدّل هذا الخيار.')}</p> : null}
                        </div>
                        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2">
                          {p.ok ? <MoneyDisplay value={p.value} size="sm" /> : null}
                          <Button type="button" variant="ghost" size="icon" aria-label={t('Edit option', 'تعديل الخيار')} onClick={() => { setIsNew(false); setEditing(s); }} data-testid={`button-edit-scenario-${s.id}`}><Pencil aria-hidden /></Button>
                          <Button type="button" variant="ghost" size="icon" aria-label={t('Remove option', 'إزالة الخيار')} onClick={() => setDeleting(s)} data-testid={`button-delete-scenario-${s.id}`}><Trash2 aria-hidden /></Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {scenarios.length > 0 ? (
              <div className="form-action-bar flex flex-wrap gap-3">
                <Button type="button" variant="gradient" className="min-w-[8rem] flex-1" disabled={!canCompare} onClick={compare} data-testid="button-compare">
                  <Scale aria-hidden />{busy ? t('Comparing…', 'جارٍ المقارنة…') : t('Compare', 'قارن')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setClearOpen(true)} data-testid="button-reset"><RotateCcw aria-hidden />{t('Clear', 'مسح')}</Button>
              </div>
            ) : null}
          </div>

          <section aria-live="polite" className="min-w-0" data-testid="section-result">
            <ResultArea run={run} t={t} locale={locale} accounts={accounts} onRerun={() => void rerun()} />
          </section>
        </div>
      </PullToRefresh>

      {editing ? (
        <ScenarioDialog key={editing.id} initial={editing} isNew={isNew} through={through} accounts={accounts} t={t}
          onCancel={() => setEditing(null)} onSave={saveScenario} />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Remove this option?', 'إزالة هذا الخيار؟')}</AlertDialogTitle>
            <AlertDialogDescription>{t(`“${deleting?.item ?? ''}” will be removed from this comparison. Nothing is saved anywhere.`, `سيُزال «${deleting?.item ?? ''}» من هذه المقارنة. لا يُحفظ شيء.`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('Keep', 'إبقاء')}</AlertDialogCancel>
            <AlertDialogAction onClick={removeScenario} data-testid="button-confirm-delete">{t('Remove', 'إزالة')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Clear this comparison?', 'مسح هذه المقارنة؟')}</AlertDialogTitle>
            <AlertDialogDescription>{t('All options and results on this screen will be cleared.', 'ستُمسح كل الخيارات والنتائج في هذه الشاشة.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">{t('Keep', 'إبقاء')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetAll(); setClearOpen(false); }} data-testid="button-confirm-clear">{t('Clear', 'مسح')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p role="alert" className="type-caption text-destructive" data-testid={`error-${id}`}>{error}</p>
        : hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ScenarioDialog({ initial, isNew, through, accounts, t, onCancel, onSave }: {
  initial: ScenarioDraft; isNew: boolean; through: string; accounts: FinanceAccount[]; t: Tx; onCancel: () => void; onSave: (s: ScenarioDraft) => void;
}) {
  const [s, setS] = useState<ScenarioDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = <K extends keyof ScenarioDraft>(k: K, v: ScenarioDraft[K]) => setS((p) => ({ ...p, [k]: v, ...(k === 'currency' ? { accountId: 'all' } : {}) }));
  const sameCurrency = accounts.filter((a) => a.currency === s.currency);
  const today = utcToday();
  const save = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateScenario(s, through);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...s, item: s.item.trim(), price: s.price.trim() });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <form onSubmit={save} noValidate className="flex flex-col gap-4" data-testid="form-scenario">
          <DialogHeader>
            <DialogTitle>{isNew ? t('Add a purchase option', 'إضافة خيار شراء') : t('Edit option', 'تعديل الخيار')}</DialogTitle>
            <DialogDescription>{t('Treated as an extra purchase on top of your plan. Goal savings stay protected.', 'يُعامل كشراء إضافي فوق خطتك. تبقى مدخرات الأهداف محمية.')}</DialogDescription>
          </DialogHeader>
          <Field id="sc-item" label={t('Item', 'العنصر')} error={errors.item ? t('Name the item.', 'اكتب اسم العنصر.') : undefined}>
            <Input id="sc-item" value={s.item} maxLength={120} onChange={(e) => set('item', e.target.value)} placeholder={t('e.g. Laptop stand', 'مثلاً: حامل حاسوب')} data-testid="input-item" />
          </Field>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_auto]">
            <Field id="sc-price" label={t('Price', 'السعر')} error={errors.price ? amountErrorText(errors.price, s.currency, t) : undefined}>
              <Input id="sc-price" inputMode="decimal" dir="ltr" className="tabular" value={s.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" data-testid="input-price" />
            </Field>
            <Field id="sc-currency" label={t('Currency', 'العملة')}>
              <Select value={s.currency} onValueChange={(v) => set('currency', v as Currency)}>
                <SelectTrigger id="sc-currency" className="min-w-24" data-testid="select-currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field id="sc-cat" label={t('Category (optional)', 'الفئة (اختياري)')} hint={t('Needed to compare against a budget.', 'مطلوبة للمقارنة مع ميزانية.')}>
            <Select value={s.category || 'none'} onValueChange={(v) => set('category', v === 'none' ? '' : v)}>
              <SelectTrigger id="sc-cat" data-testid="select-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('No category', 'بدون فئة')}</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(...(CATEGORY[c] ?? [c, c]))}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sc-date" label={t('Purchase date (optional)', 'تاريخ الشراء (اختياري)')} hint={t('Blank means today.', 'الفراغ يعني اليوم.')}
            error={errors.date ? t('Choose a date between today and the end of the window.', 'اختر تاريخاً بين اليوم ونهاية النافذة.') : undefined}>
            <Input id="sc-date" type="date" min={today} max={through} value={s.date} onChange={(e) => set('date', e.target.value)} data-testid="input-date" />
          </Field>
          <Field id="sc-acct" label={t('Pay from (optional)', 'الدفع من (اختياري)')}>
            <Select value={s.accountId} onValueChange={(v) => set('accountId', v)}>
              <SelectTrigger id="sc-acct" data-testid="select-account"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(`All available ${s.currency} money`, `كل المال المتاح بـ${s.currency}`)}</SelectItem>
                {sameCurrency.map((a) => <SelectItem key={a.id} value={a.id}>{accountName(a, t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} data-testid="button-cancel-scenario">{t('Cancel', 'إلغاء')}</Button>
            <Button type="submit" data-testid="button-save-scenario">{isNew ? t('Add', 'إضافة') : t('Save', 'حفظ')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

