import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Landmark, Loader2, PiggyBank, Trash2 } from 'lucide-react';
import { Page, PageHeader, Section, SpecimenTag } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { ProgressMeter } from '@/components/finance/progress-meter';
import { AccountSurface } from '@/components/finance/account-surface';
import { TransactionRow } from '@/components/finance/transaction-row';
import { StatusBadge } from '@/components/finance/status-badge';
import { useI18n } from '@/features/i18n/i18n-provider';
import { CURRENCIES, formatDate, formatNumber, money, parseMoney, type Currency } from '@/lib/money';
import type { TranslationKey } from '@/features/i18n/dictionary';

/*
 * SPECIMEN VALUES — fixed constants used only to verify component formatting.
 * They are not user data, not balances, and must never be reused by features.
 */
const SPECIMEN = {
  primary: money(128450),
  inflow: money(25000),
  outflow: money(-1875),
  pending: money(-4200),
  account: money(64210),
  account2: money(31980, 'USD'),
  perCurrency: { ILS: money(123456, 'ILS'), USD: money(123456, 'USD'), JOD: money(123456, 'JOD') },
  date: new Date(Date.UTC(2025, 2, 14, 9, 30)),
} as const;

const TOC: { id: string; key: TranslationKey }[] = [
  { id: 'type', key: 'fd.type' },
  { id: 'color', key: 'fd.color' },
  { id: 'spacing', key: 'fd.spacing' },
  { id: 'actions', key: 'fd.actions' },
  { id: 'forms', key: 'fd.forms' },
  { id: 'states', key: 'fd.states' },
  { id: 'badges', key: 'fd.badges' },
  { id: 'money', key: 'fd.money' },
  { id: 'progress', key: 'fd.progress' },
  { id: 'account', key: 'fd.account' },
  { id: 'txn', key: 'fd.txn' },
  { id: 'overlays', key: 'fd.overlays' },
];

function Swatch({ token, label, fg }: { token: string; label: string; fg?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="size-10 shrink-0 rounded-lg border border-divider" style={{ background: `hsl(var(${token}))` }} aria-hidden>
        {fg ? <span className="grid size-full place-items-center text-xs font-semibold" style={{ color: `hsl(var(${fg}))` }}>Aa</span> : null}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <code dir="ltr" className="text-start font-mono text-xs text-muted-foreground">{token}</code>
      </div>
    </li>
  );
}

function ActionsSpecimen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = () => {
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      toast({ title: t('fd.act.done'), description: t('fd.act.doneBody') });
    }, 2000);
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy} aria-busy={busy} data-testid="button-specimen-primary">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {busy ? t('fd.act.loading') : t('fd.act.primary')}
        </Button>
        <Button variant="secondary" onClick={() => toast({ title: t('fd.act.secondary'), description: t('spec.note') })} data-testid="button-specimen-secondary">
          {t('fd.act.secondary')}
        </Button>
        <Button variant="ghost" onClick={() => toast({ title: t('fd.act.tertiary'), description: t('spec.note') })} data-testid="button-specimen-tertiary">
          {t('fd.act.tertiary')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DestructiveConfirm />
        <Button disabled data-testid="button-specimen-disabled">{t('fd.act.disabled')}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('fd.act.simulate')}</p>
    </div>
  );
}

function DestructiveConfirm({ label }: { label?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button ref={triggerRef} variant="destructive" data-testid="button-specimen-destructive">
          <Trash2 aria-hidden />
          {label ?? t('fd.act.destructive')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={() => setOpen(false)}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="text-start sm:text-start">
          <AlertDialogTitle>{t('fd.dlg.title')}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">{t('fd.dlg.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel data-testid="button-dialog-cancel">{t('fd.dlg.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => toast({ title: t('fd.dlg.removed'), description: t('fd.dlg.removedBody') })}
            data-testid="button-dialog-confirm"
          >
            {t('fd.dlg.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const AMOUNT_RE = /^\d{1,9}(\.\d{1,2})?$/;

function FormSpecimen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const schema = z.object({
    label: z.string().trim().min(2, t('fd.form.nameErr')).max(40, t('fd.form.nameErr')),
    amount: z.string().trim().regex(AMOUNT_RE, t('fd.form.amountErr')),
    currency: z.enum(['ILS', 'USD', 'JOD']),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { label: '', amount: '', currency: 'ILS' }, mode: 'onTouched' });
  const amount = form.watch('amount');
  const currency = form.watch('currency') as Currency;
  const parsed = AMOUNT_RE.test(amount.trim()) ? parseMoney(amount.trim(), currency) : null;

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(() => toast({ title: t('fd.form.valid'), description: t('fd.form.validBody') }))}
        className="flex max-w-lg flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fd.form.name')}</FormLabel>
              <FormControl>
                <Input {...field} className="h-11" data-testid="input-specimen-label" />
              </FormControl>
              <FormDescription>{t('fd.form.nameHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fd.form.amount')}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" dir="ltr" className="tabular h-11 text-start" placeholder="0.00" data-testid="input-specimen-amount" />
                </FormControl>
                <FormDescription>{t('fd.form.amountHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fd.form.currency')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11" data-testid="select-specimen-currency">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center justify-between gap-4 border-y border-divider py-3 text-sm" aria-live="polite">
          <span className="flex items-center gap-2 text-muted-foreground">
            {t('fd.form.preview')} <SpecimenTag label={t('spec.tag')} />
          </span>
          {parsed ? (
            <span className="flex flex-col items-end">
              <MoneyDisplay value={parsed} size="sm" testId="text-parsed-amount" />
              <span className="tabular text-xs text-muted-foreground">{t('fd.form.minor', { minor: formatNumber(parsed.minor, 'en-US') })}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="specimen-disabled" className="text-muted-foreground">{t('fd.form.disabled')}</Label>
          <Input id="specimen-disabled" disabled value={t('fd.act.disabled')} readOnly className="h-11" />
        </div>
        <div>
          <Button type="submit" data-testid="button-specimen-validate">{t('fd.form.submit')}</Button>
        </div>
      </form>
    </Form>
  );
}

function StatesSpecimen() {
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);
  const [tab, setTab] = useState('loading');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const retry = () => {
    setRetrying(true);
    timer.current = window.setTimeout(() => {
      setRetrying(false);
      setTab('success');
    }, 1400);
  };
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto flex-wrap justify-start">
        {(['loading', 'empty', 'error', 'success'] as const).map((s) => (
          <TabsTrigger key={s} value={s} className="min-h-9" data-testid={`tab-state-${s}`}>{t(`fd.state.${s}`)}</TabsTrigger>
        ))}
      </TabsList>
      <div className="mt-2 min-h-[16rem]">
        <TabsContent value="loading"><SkeletonRows rows={3} label={t('fd.state.loadingLabel')} /></TabsContent>
        <TabsContent value="empty">
          <StatePanel tone="empty" title={t('fd.state.emptyTitle')} body={t('fd.state.emptyBody')} action={<Button variant="link" className="h-auto px-0" onClick={() => setTab('success')} data-testid="button-empty-learn">{t('fd.state.emptyAction')}</Button>} />
        </TabsContent>
        <TabsContent value="error">
          <StatePanel tone="error" title={t('fd.state.errorTitle')} body={t('fd.state.errorBody')} action={<RetryButton label={t('err.retry')} busyLabel={t('fd.state.retrying')} busy={retrying} onClick={retry} />} />
        </TabsContent>
        <TabsContent value="success"><StatePanel tone="success" title={t('fd.state.successTitle')} body={t('fd.state.successBody')} /></TabsContent>
      </div>
    </Tabs>
  );
}

function OverlaysSpecimen() {
  const { t, dir } = useI18n();
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : dir === 'rtl' ? 'left' : 'right';
  return (
    <div className="flex flex-wrap gap-3">
      <DestructiveConfirm label={t('fd.dlg.open')} />
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="button-open-sheet">{t('fd.sheet.open')}</Button>
        </SheetTrigger>
        <SheetContent side={side} className={isMobile ? 'rounded-t-2xl' : 'w-full sm:max-w-md'}>
          <SheetHeader className="text-start">
            <SheetTitle>{t('fd.sheet.title')}</SheetTitle>
            <SheetDescription className="leading-6">{t('fd.sheet.body')}</SheetDescription>
          </SheetHeader>
          <dl className="my-6 divide-y divide-divider border-y border-divider text-sm">
            <div className="flex flex-col gap-1 py-3"><dt className="text-muted-foreground">{t('fd.sheet.row1')}</dt><dd className="font-medium">{t('fd.sheet.row1v')}</dd></div>
            <div className="flex flex-col gap-1 py-3"><dt className="text-muted-foreground">{t('fd.sheet.row2')}</dt><dd className="font-medium">{t('fd.sheet.row2v')}</dd></div>
          </dl>
          <SheetFooter>
            <SheetClose asChild><Button data-testid="button-sheet-done">{t('fd.sheet.done')}</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function FoundationPage() {
  const { t, locale } = useI18n();
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(64);
  const p = progress / 100;
  const status = p >= 1 ? 'done' : p >= 0.8 ? 'near' : 'on';
  const statusLabel = t(status === 'done' ? 'fd.progress.done' : status === 'near' ? 'fd.progress.near' : 'fd.progress.on');
  const hiddenLabel = t('fd.money.hiddenLabel');
  const specimenDate = formatDate(SPECIMEN.date, locale);

  return (
    <Page className="max-w-6xl">
      <PageHeader eyebrow={t('fd.eyebrow')} title={t('fd.title')} lede={t('fd.lede')} />

      <nav aria-label={t('fd.toc')} className="mb-2 pb-4">
        <ul className="flex flex-wrap gap-1.5">
          {TOC.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-8 items-center rounded-full border border-divider px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-input hover:text-foreground" data-testid={`link-toc-${s.id}`}>
                {t(s.key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="type" title={t('fd.type')} description={t('fd.typeBody')}>
        <dl className="divide-y divide-divider">
          {[
            { k: 'fd.type.display' as const, cls: 'text-[40px] md:text-5xl font-semibold tracking-tight leading-[1.1]', spec: '48 / 600', txt: t('fd.type.sample') },
            { k: 'fd.type.title' as const, cls: 'text-[28px] font-semibold tracking-tight leading-tight', spec: '28 / 600', txt: t('fd.type.sample') },
            { k: 'fd.type.heading' as const, cls: 'text-lg font-semibold', spec: '18 / 600', txt: t('fd.type.sample') },
            { k: 'fd.type.body' as const, cls: 'text-base leading-7', spec: '16 / 400', txt: t('fd.type.bodySample') },
            { k: 'fd.type.caption' as const, cls: 'text-xs text-muted-foreground', spec: '12 / 400', txt: t('fd.type.bodySample') },
          ].map((r) => (
            <div key={r.k} className="grid gap-2 py-4 sm:grid-cols-[7rem_1fr] sm:items-baseline">
              <dt className="flex gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t(r.k)}</span>
                <span dir="ltr" className="tabular">{r.spec}</span>
              </dt>
              <dd className={r.cls}>{r.txt}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="color" title={t('fd.color')} description={t('fd.colorBody')}>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          <Swatch token="--primary" fg="--primary-foreground" label={t('fd.color.primary')} />
          <Swatch token="--success-soft" fg="--success" label={t('fd.color.success')} />
          <Swatch token="--warning-soft" fg="--warning" label={t('fd.color.warning')} />
          <Swatch token="--destructive-soft" fg="--destructive" label={t('fd.color.destructive')} />
          <Swatch token="--foreground" label={t('fd.color.foreground')} />
          <Swatch token="--muted-foreground" label={t('fd.color.muted')} />
          <Swatch token="--surface" label={t('fd.color.surface')} />
          <Swatch token="--background" label={t('fd.color.canvas')} />
        </ul>
      </Section>

      <Section id="spacing" title={t('fd.spacing')} description={t('fd.spacingBody')}>
        <div className="flex flex-col gap-8">
          <div className="flex items-end gap-3" dir="ltr">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <span className="rounded-sm bg-primary/80" style={{ width: n * 4, height: n * 4 }} aria-hidden />
                <span className="tabular text-[11px] text-muted-foreground">{n * 4}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4" dir="ltr">
            {[{ r: 'rounded-sm', l: '8' }, { r: 'rounded-md', l: '10' }, { r: 'rounded-lg', l: '12' }, { r: 'rounded-xl', l: '16' }].map((x) => (
              <div key={x.r} className={`grid size-16 place-items-center border border-input bg-surface text-xs text-muted-foreground ${x.r}`}>{x.l}</div>
            ))}
            {['shadow-sm', 'shadow-md', 'shadow-lg'].map((s) => (
              <div key={s} className={`grid size-16 place-items-center rounded-lg bg-surface text-[10px] text-muted-foreground ${s}`}>{s.replace('shadow-', '')}</div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="actions" title={t('fd.actions')} description={t('fd.actionsBody')}><ActionsSpecimen /></Section>
      <Section id="forms" title={t('fd.forms')} description={t('fd.formsBody')}><FormSpecimen /></Section>
      <Section id="states" title={t('fd.states')} description={t('fd.statesBody')}><StatesSpecimen /></Section>

      <Section id="badges" title={t('fd.badges')} description={t('fd.badgesBody')}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral" label={t('fd.badge.neutral')} />
          <StatusBadge tone="info" label={t('fd.badge.info')} />
          <StatusBadge tone="success" label={t('fd.badge.success')} />
          <StatusBadge tone="warning" label={t('fd.badge.warning')} />
          <StatusBadge tone="error" label={t('fd.badge.error')} />
        </div>
      </Section>

      <Section
        id="money"
        title={t('fd.money')}
        description={t('fd.moneyBody')}
        aside={
          <div className="flex items-center gap-3 pt-3">
            <Switch id="hide-amounts" checked={hidden} onCheckedChange={setHidden} data-testid="switch-hide-amounts" />
            <Label htmlFor="hide-amounts" className="text-sm">{t('fd.money.hidden')}</Label>
          </div>
        }
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t('fd.money.primary')}</span>
              <SpecimenTag label={t('spec.tag')} />
            </div>
            <MoneyDisplay value={SPECIMEN.primary} size="xl" hidden={hidden} hiddenLabel={hiddenLabel} testId="text-specimen-primary-amount" />
          </div>
          <dl className="grid divide-y divide-divider border-y border-divider sm:grid-cols-2 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
            <div className="flex flex-col gap-1 py-4 sm:pe-6">
              <dt className="text-sm text-muted-foreground">{t('fd.money.inflow')}</dt>
              <dd><MoneyDisplay value={SPECIMEN.inflow} size="lg" tone="positive" showPlus hidden={hidden} hiddenLabel={hiddenLabel} /></dd>
            </div>
            <div className="flex flex-col gap-1 py-4 sm:ps-6">
              <dt className="text-sm text-muted-foreground">{t('fd.money.outflow')}</dt>
              <dd><MoneyDisplay value={SPECIMEN.outflow} size="lg" hidden={hidden} hiddenLabel={hiddenLabel} /></dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t('fd.money.currencies')}</span>
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {CURRENCIES.map((c) => (
                <li key={c} className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{c}</span>
                  <MoneyDisplay value={SPECIMEN.perCurrency[c]} hidden={hidden} hiddenLabel={hiddenLabel} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="progress" title={t('fd.progress')} description={t('fd.progressBody')}>
        <div className="flex max-w-lg flex-col gap-6">
          <ProgressMeter value={p} label={t('fd.progress.label')} status={status} statusLabel={statusLabel} />
          <div className="flex flex-col gap-3">
            <Label id="progress-adjust" className="text-sm text-muted-foreground">{t('fd.progress.adjust')}</Label>
            <Slider aria-labelledby="progress-adjust" value={[progress]} min={0} max={100} step={1} onValueChange={([v]) => setProgress(v)} data-testid="slider-progress" />
          </div>
        </div>
      </Section>

      <Section id="account" title={t('fd.account')} description={t('fd.accountBody')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountSurface
            name={t('fd.account.name')}
            kind={t('fd.account.kind')}
            amount={SPECIMEN.account}
            meta={t('fd.account.meta', { date: specimenDate })}
            badge={<SpecimenTag label={t('spec.tag')} />}
            icon={<Landmark />}
            hidden={hidden}
            hiddenLabel={hiddenLabel}
            emphasis
            testId="surface-specimen-account-1"
          />
          <AccountSurface
            name={t('fd.account.name')}
            kind={t('fd.account.kind2')}
            amount={SPECIMEN.account2}
            meta={t('fd.account.meta', { date: specimenDate })}
            badge={<SpecimenTag label={t('spec.tag')} />}
            icon={<PiggyBank />}
            hidden={hidden}
            hiddenLabel={hiddenLabel}
            testId="surface-specimen-account-2"
          />
        </div>
      </Section>

      <Section id="txn" title={t('fd.txn')} description={t('fd.txnBody')} aside={<SpecimenTag label={t('spec.tag')} className="mt-2 w-fit" />}>
        <ul className="divide-y divide-divider border-y border-divider">
          <TransactionRow title={t('fd.txn.a')} meta={t('fd.txn.aMeta')} amount={SPECIMEN.outflow} date={SPECIMEN.date} direction="out" directionLabel={t('fd.txn.out')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-1" />
          <TransactionRow title={t('fd.txn.b')} meta={t('fd.txn.bMeta')} amount={SPECIMEN.inflow} date={SPECIMEN.date} direction="in" directionLabel={t('fd.txn.in')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-2" />
          <TransactionRow title={t('fd.txn.c')} meta={t('fd.txn.cMeta')} amount={SPECIMEN.pending} date={SPECIMEN.date} direction="pending" directionLabel={t('fd.txn.cMeta')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-3" />
        </ul>
      </Section>

      <Section id="overlays" title={t('fd.overlays')} description={t('fd.overlaysBody')}><OverlaysSpecimen /></Section>
    </Page>
  );
}
