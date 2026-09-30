import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeftRight,
  Bell,
  CalendarClock,
  Eye,
  Goal,
  Home,
  Landmark,
  Loader2,
  MoreHorizontal,
  PiggyBank,
  Search,
  Settings,
  Trash2,
  Wallet,
  Map as MapIcon,
} from 'lucide-react';
import { Link } from 'wouter';
import { Page, PageHeader, SpecimenTag } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Notice, RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { ProgressMeter } from '@/components/finance/progress-meter';
import { AccountSurface } from '@/components/finance/account-surface';
import { TransactionRow } from '@/components/finance/transaction-row';
import { StatusBadge } from '@/components/finance/status-badge';
import { BalanceDisplay } from '@/components/finance/balance-display';
import { FinancialSummary } from '@/components/finance/financial-summary';
import { UpcomingPayment } from '@/components/finance/upcoming-payment';
import { useI18n } from '@/features/i18n/i18n-provider';
import { CURRENCIES, formatDate, formatMoney, formatNumber, money, parseMoney, type Currency } from '@/lib/money';
import type { TranslationKey } from '@/features/i18n/dictionary';
import { cn } from '@/lib/utils';

/*
 * SPECIMEN VALUES — fixed constants used only to verify component formatting.
 * They are not user data, not balances, and must never be reused by features.
 */
const SPECIMEN = {
  primary: money(128450),
  inflow: money(25000),
  outflow: money(-1875),
  pending: money(-4200),
  planned: money(60000),
  projected: money(41530),
  neutral: money(0),
  account: money(64210),
  account2: money(31980, 'USD'),
  upcoming: money(-4990),
  savedOf: { saved: money(186000), target: money(420000) },
  budgetOf: { spent: money(131240), plan: money(210000) },
  perCurrency: { ILS: money(123456, 'ILS'), USD: money(123456, 'USD'), JOD: money(123456, 'JOD') },
  date: new Date(Date.UTC(2025, 2, 14, 9, 30)),
  due: new Date(Date.UTC(2025, 2, 30, 9, 0)),
} as const;

const GROUPS: { id: string; key: TranslationKey; body: TranslationKey }[] = [
  { id: 'foundations', key: 'g.foundations', body: 'g.foundationsBody' },
  { id: 'actions', key: 'g.actions', body: 'g.actionsBody' },
  { id: 'inputs', key: 'g.inputs', body: 'g.inputsBody' },
  { id: 'financial', key: 'g.financial', body: 'g.financialBody' },
  { id: 'feedback', key: 'g.feedback', body: 'g.feedbackBody' },
  { id: 'overlays', key: 'g.overlays', body: 'g.overlaysBody' },
  { id: 'navigation', key: 'g.navigation', body: 'g.navigationBody' },
];

/* ---------- Gallery layout primitives (page-local composition, not new design-system components) ---------- */

function Group({ index, children }: { index: number; children: ReactNode }) {
  const { t, locale } = useI18n();
  const g = GROUPS[index];
  return (
    <section id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-20 pb-6 pt-14 first:pt-2 md:pt-20">
      <header className="flex flex-col gap-2 pb-4">
        <span className="tabular type-label font-medium text-gold-ink" aria-hidden>
          <bdi>{formatNumber(index + 1, locale).padStart(2, '0')}</bdi>
        </span>
        <h2 id={`${g.id}-title`} className="type-display">{t(g.key)}</h2>
        <p className="max-w-xl type-body text-muted-foreground">{t(g.body)}</p>
      </header>
      <div className="@container min-w-0">{children}</div>
    </section>
  );
}

function Specimen({ id, title, description, aside, children }: { id?: string; title: string; description?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="grid-cols-[minmax(0,1fr)] grid scroll-mt-20 gap-5 border-t border-divider py-8 @3xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] @3xl:gap-10">
      <div className="flex flex-col gap-1.5">
        <h3 className="type-body font-semibold">{title}</h3>
        {description ? <p className="type-label font-normal text-muted-foreground">{description}</p> : null}
        {aside}
      </div>
      <div className="@container min-w-0">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid-cols-[minmax(0,1fr)] grid items-center gap-2 py-3 @lg:grid-cols-[7rem_minmax(0,1fr)] @lg:gap-6">
      <span className="type-label font-normal text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({ token, label, ink }: { token: string; label: string; ink?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid-cols-[minmax(0,1fr)] grid size-10 shrink-0 place-items-center rounded-lg border border-divider" style={{ background: ink ? 'transparent' : `hsl(var(${token}))` }} aria-hidden>
        {ink ? <span className="type-body font-semibold" style={{ color: `hsl(var(${token}))` }}>Aa</span> : null}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="type-label font-medium">{label}</span>
        <code dir="ltr" className="break-all text-start font-mono type-caption text-muted-foreground">{token}</code>
      </div>
    </li>
  );
}

/* ---------- Actions ---------- */

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
    <div className="flex flex-col divide-y divide-divider">
      <Row label={t('a.row.primary')}>
        <Button onClick={run} disabled={busy} aria-busy={busy} data-testid="button-specimen-primary">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {busy ? t('fd.act.loading') : t('fd.act.primary')}
        </Button>
      </Row>
      <Row label={t('a.row.secondary')}>
        <Button variant="secondary" onClick={() => toast({ title: t('fd.act.secondary'), description: t('spec.note') })} data-testid="button-specimen-secondary">
          {t('fd.act.secondary')}
        </Button>
        <Button variant="outline" onClick={() => toast({ title: t('fd.act.secondary'), description: t('spec.note') })} data-testid="button-specimen-outline">
          {t('fd.act.secondary')}
        </Button>
      </Row>
      <Row label={t('a.row.tertiary')}>
        <Button variant="ghost" onClick={() => toast({ title: t('fd.act.tertiary'), description: t('spec.note') })} data-testid="button-specimen-tertiary">
          {t('fd.act.tertiary')}
        </Button>
        <Button variant="link" className="px-0" onClick={() => toast({ title: t('fd.act.tertiary'), description: t('spec.note') })} data-testid="button-specimen-link">
          {t('fd.act.tertiary')}
        </Button>
      </Row>
      <Row label={t('a.row.destructive')}>
        <DestructiveConfirm />
      </Row>
      <Row label={t('a.row.icon')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="icon" aria-label={t('a.iconLabel')} onClick={() => toast({ title: t('a.iconLabel'), description: t('spec.note') })} data-testid="button-specimen-icon">
              <Eye aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('a.iconLabel')}</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" aria-label={t('ov.menuOpen')} onClick={() => toast({ title: t('ov.menuOpen'), description: t('spec.note') })} data-testid="button-specimen-icon-ghost">
          <MoreHorizontal aria-hidden />
        </Button>
      </Row>
      <Row label={t('a.row.loading')}>
        <Button disabled aria-busy data-testid="button-specimen-loading">
          <Loader2 className="animate-spin" aria-hidden />
          {t('fd.act.loading')}
        </Button>
      </Row>
      <Row label={t('a.row.disabled')}>
        <Button disabled data-testid="button-specimen-disabled">{t('fd.act.disabled')}</Button>
        <Button variant="secondary" disabled>{t('fd.act.disabled')}</Button>
      </Row>
      <p className="pt-4 type-label font-normal text-muted-foreground">{t('fd.act.simulate')}</p>
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
        <Button ref={triggerRef} variant={label ? 'secondary' : 'destructive'} data-testid={label ? 'button-open-dialog' : 'button-specimen-destructive'}>
          {label ? null : <Trash2 aria-hidden />}
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
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
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

/* ---------- Inputs ---------- */

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
                <Input {...field} data-testid="input-specimen-label" />
              </FormControl>
              <FormDescription>{t('fd.form.nameHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid-cols-[minmax(0,1fr)] grid gap-5 @lg:grid-cols-[minmax(0,1fr)_9rem]">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fd.form.amount')}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" dir="ltr" className="tabular text-start text-[17px] font-medium" placeholder="0.00" data-testid="input-specimen-amount" />
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
                    <SelectTrigger className="h-11 rounded-[10px] bg-surface" data-testid="select-specimen-currency">
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
        <div className="flex items-center justify-between gap-4 border-y border-divider py-3 type-label font-normal" aria-live="polite">
          <span className="flex items-center gap-2 text-muted-foreground">
            {t('fd.form.preview')} <SpecimenTag label={t('spec.tag')} />
          </span>
          {parsed ? (
            <span className="flex flex-col items-end">
              <MoneyDisplay value={parsed} size="md" testId="text-parsed-amount" />
              <span className="tabular type-caption text-muted-foreground">{t('fd.form.minor', { minor: formatNumber(parsed.minor, 'en-US') })}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <Button type="submit" data-testid="button-specimen-validate">{t('fd.form.submit')}</Button>
        </div>
      </form>
    </Form>
  );
}

function ChoiceSpecimen() {
  const { t } = useI18n();
  const [remind, setRemind] = useState(true);
  const [roundUp, setRoundUp] = useState(false);
  return (
    <div className="flex max-w-lg flex-col divide-y divide-divider border-y border-divider">
      <div className="relative flex min-h-14 items-start gap-3 py-3">
        <span className="grid-cols-[minmax(0,1fr)] grid size-11 shrink-0 -m-3 place-items-center">
          <Checkbox id="spec-remind" checked={remind} onCheckedChange={(v) => setRemind(v === true)} className="after:absolute after:-inset-3" data-testid="checkbox-specimen-remind" />
        </span>
        <div className="flex flex-col gap-0.5 ps-3">
          <Label htmlFor="spec-remind" className="type-body flex min-h-6 cursor-pointer items-center font-medium">{t('i.check')}</Label>
          <span className="type-label font-normal text-muted-foreground">{t('i.checkHint')}</span>
        </div>
      </div>
      <div className="flex min-h-14 items-center justify-between gap-4 py-3">
        <Label htmlFor="spec-roundup" className="flex min-h-11 flex-1 cursor-pointer items-center type-body font-medium">{t('i.switch')}</Label>
        <Switch id="spec-roundup" checked={roundUp} onCheckedChange={setRoundUp} data-testid="switch-specimen-roundup" />
      </div>
      <div className="flex min-h-14 items-center justify-between gap-4 py-3 opacity-100">
        <Label htmlFor="spec-disabled-switch" className="flex min-h-11 flex-1 cursor-pointer items-center type-body text-muted-foreground">{t('fd.act.disabled')}</Label>
        <Switch id="spec-disabled-switch" disabled checked />
      </div>
    </div>
  );
}

function ValidationSpecimen() {
  const { t } = useI18n();
  return (
    <div className="grid-cols-[minmax(0,1fr)] grid max-w-2xl gap-6 @lg:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="spec-invalid" className="text-destructive">{t('fd.form.amount')}</Label>
        <Input id="spec-invalid" aria-invalid="true" aria-describedby="spec-invalid-msg" defaultValue="0" dir="ltr" inputMode="decimal" className="tabular text-start" data-testid="input-specimen-invalid" />
        <p id="spec-invalid-msg" className="type-label font-medium text-destructive">{t('i.invalidMsg')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="spec-valid">{t('fd.form.name')}</Label>
        <Input id="spec-valid" aria-describedby="spec-valid-msg" defaultValue={t('hs.sv.laptop')} className="border-success/60" data-testid="input-specimen-valid" />
        <p id="spec-valid-msg" className="type-label font-normal text-success">{t('i.valid')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="specimen-disabled" className="text-muted-foreground">{t('fd.form.disabled')}</Label>
        <Input id="specimen-disabled" disabled value={t('fd.act.disabled')} readOnly />
      </div>
    </div>
  );
}

/* ---------- Feedback ---------- */

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
      <TabsList className="w-full flex-wrap">
        {(['loading', 'empty', 'error', 'success', 'permission'] as const).map((s) => (
          <TabsTrigger key={s} value={s} data-testid={`tab-state-${s}`}>{t(`fd.state.${s}`)}</TabsTrigger>
        ))}
      </TabsList>
      <div className="mt-2 min-h-[15rem]">
        <TabsContent value="loading"><SkeletonRows rows={3} label={t('fd.state.loadingLabel')} /></TabsContent>
        <TabsContent value="empty">
          <StatePanel tone="empty" title={t('fd.state.emptyTitle')} body={t('fd.state.emptyBody')} action={<Button variant="link" className="h-auto px-0" onClick={() => setTab('success')} data-testid="button-empty-learn">{t('fd.state.emptyAction')}</Button>} />
        </TabsContent>
        <TabsContent value="error">
          <StatePanel tone="error" title={t('fd.state.errorTitle')} body={t('fd.state.errorBody')} action={<RetryButton label={t('err.retry')} busyLabel={t('fd.state.retrying')} busy={retrying} onClick={retry} />} />
        </TabsContent>
        <TabsContent value="success"><StatePanel tone="success" title={t('fd.state.successTitle')} body={t('fd.state.successBody')} /></TabsContent>
        <TabsContent value="permission"><StatePanel tone="permission" title={t('fd.state.permTitle')} body={t('fd.state.permBody')} /></TabsContent>
      </div>
    </Tabs>
  );
}

/* ---------- Overlays ---------- */

function SheetSpecimen() {
  const { t, dir } = useI18n();
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : dir === 'rtl' ? 'left' : 'right';
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" data-testid="button-open-sheet">{t('fd.sheet.open')}</Button>
      </SheetTrigger>
      <SheetContent side={side} className={isMobile ? 'max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]' : 'w-full overflow-y-auto sm:max-w-md'}>
        <SheetHeader className="text-start">
          <SheetTitle>{t('fd.sheet.title')}</SheetTitle>
          <SheetDescription className="leading-6">{t('fd.sheet.body')}</SheetDescription>
        </SheetHeader>
        <dl className="my-6 divide-y divide-divider border-y border-divider type-label font-normal">
          <div className="flex flex-col gap-1 py-3"><dt className="text-muted-foreground">{t('fd.sheet.row1')}</dt><dd className="font-medium">{t('fd.sheet.row1v')}</dd></div>
          <div className="flex flex-col gap-1 py-3"><dt className="text-muted-foreground">{t('fd.sheet.row2')}</dt><dd className="font-medium">{t('fd.sheet.row2v')}</dd></div>
        </dl>
        <SheetFooter>
          <SheetClose asChild><Button size="lg" className="w-full sm:w-auto" data-testid="button-sheet-done">{t('fd.sheet.done')}</Button></SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ReviewSpecimen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button ref={triggerRef} variant="secondary" data-testid="button-open-review">{t('ov.reviewOpen')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={() => setOpen(false)}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="text-start sm:text-start">
          <div><SpecimenTag label={t('spec.tag')} /></div>
          <AlertDialogTitle>{t('ov.reviewTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">{t('ov.reviewBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col items-start gap-1 border-t border-divider pt-4">
          <span className="type-label font-normal text-muted-foreground">{t('ov.amount')}</span>
          <MoneyDisplay value={SPECIMEN.planned} size="xl" testId="text-review-amount" />
        </div>
        <dl className="divide-y divide-divider border-y border-divider type-label font-normal">
          <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{t('ov.from')}</dt><dd className="min-w-0 break-words text-end font-medium">{t('ov.fromV')}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{t('ov.to')}</dt><dd className="min-w-0 break-words text-end font-medium">{t('ov.toV')}</dd></div>
        </dl>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <AlertDialogCancel data-testid="button-review-back">{t('ov.back')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => toast({ title: t('ov.done'), description: t('ov.doneBody') })} data-testid="button-review-confirm">
            {t('ov.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MenuSpecimen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const pick = (label: string) => toast({ title: t('ov.menuToast'), description: `${label} — ${t('spec.note')}` });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" data-testid="button-open-menu">
          <MoreHorizontal aria-hidden />
          {t('ov.menuOpen')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onSelect={() => pick(t('ov.menu.rename'))} data-testid="menu-item-rename">{t('ov.menu.rename')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => pick(t('ov.menu.export'))} data-testid="menu-item-export">{t('ov.menu.export')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => pick(t('ov.menu.remove'))} data-testid="menu-item-remove">{t('ov.menu.remove')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Navigation ---------- */

const NAV_SPEC: { icon: typeof Home; key: TranslationKey }[] = [
  { icon: Home, key: 'nav.home' },
  { icon: Wallet, key: 'nav.money' },
  { icon: ArrowLeftRight, key: 'nav.transactions' },
  { icon: MapIcon, key: 'nav.plan' },
  { icon: Goal, key: 'nav.goals' },
];

function SidebarSpecimen() {
  const { t } = useI18n();
  return (
    <div aria-hidden className="w-full max-w-[16rem] border-s border-divider ps-2">
      {NAV_SPEC.slice(0, 4).map((n, i) => {
        const Icon = n.icon;
        const active = i === 1;
        return (
          <div key={n.key} className={cn('relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm', active ? 'bg-sidebar-accent font-medium' : 'text-foreground/75')}>
            {active ? <span className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-primary" /> : null}
            <Icon className={cn('size-[18px]', active ? 'text-gold-ink' : 'text-muted-foreground')} strokeWidth={1.75} />
            {t(n.key)}
          </div>
        );
      })}
    </div>
  );
}

function BottomNavSpecimen() {
  const { t } = useI18n();
  return (
    <div aria-hidden className="grid w-full max-w-sm grid-cols-5 border-y border-divider bg-background">
      {NAV_SPEC.map((n, i) => {
        const Icon = n.icon;
        const active = i === 0;
        return (
          <div key={n.key} className={cn('relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px]', active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
            {active ? <span className="absolute inset-x-[30%] top-0 h-0.5 rounded-b-full bg-primary" /> : null}
            <Icon className={cn('size-[22px]', active && 'text-gold-ink')} strokeWidth={active ? 2 : 1.75} />
            <span className="max-w-full truncate px-0.5">{t(n.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TabsSpecimen() {
  const { t } = useI18n();
  const views = ['week', 'month', 'semester'] as const;
  return (
    <Tabs defaultValue="month" className="max-w-lg">
      <TabsList>
        {views.map((v) => (
          <TabsTrigger key={v} value={v} data-testid={`tab-specimen-${v}`}>{t(`nv.tab.${v}`)}</TabsTrigger>
        ))}
      </TabsList>
      {views.map((v) => (
        <TabsContent key={v} value={v} className="pt-3 type-label font-normal text-muted-foreground">{t('nv.tabPanel', { view: t(`nv.tab.${v}`) })}</TabsContent>
      ))}
    </Tabs>
  );
}

function CrumbsSpecimen() {
  const { t } = useI18n();
  return (
    <Breadcrumb>
      <BreadcrumbList className="type-label font-normal">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="inline-flex min-h-11 items-center" data-testid="link-crumb-home">{t('nav.home')}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="rtl:[&>svg]:-scale-x-100" />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <a href="#foundations" className="inline-flex min-h-11 items-center" data-testid="link-crumb-foundation">{t('nav.foundation')}</a>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="rtl:[&>svg]:-scale-x-100" />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-medium">{t('g.navigation')}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/* ---------- Page ---------- */

export default function FoundationPage() {
  const { t, locale } = useI18n();
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(64);
  const p = progress / 100;
  const status = p >= 1 ? 'done' : p >= 0.8 ? 'near' : 'on';
  const statusLabel = t(status === 'done' ? 'fd.progress.done' : status === 'near' ? 'fd.progress.near' : 'fd.progress.on');
  const hiddenLabel = t('fd.money.hiddenLabel');
  const specimenDate = formatDate(SPECIMEN.date, locale);
  const tag = <SpecimenTag label={t('spec.tag')} className="w-fit" />;

  const ICONS = [Home, Wallet, ArrowLeftRight, CalendarClock, PiggyBank, Landmark, Bell, Search, Settings, Eye];

  return (
    <Page className="max-w-6xl">
      <PageHeader eyebrow={t('fd.eyebrow')} title={t('fd.title')} lede={t('fd.lede')} />

      <div className="grid-cols-[minmax(0,1fr)] grid gap-10 xl:grid-cols-[10rem_minmax(0,1fr)] xl:gap-14">
        <nav aria-label={t('fd.toc')} className="min-w-0 xl:sticky xl:top-10 xl:self-start">
          <p className="hidden pb-3 type-caption font-medium text-muted-foreground xl:block">{t('g.index')}</p>
          <ol className="-mx-1 flex flex-wrap gap-1 pb-1 xl:mx-0 xl:flex-col xl:flex-nowrap xl:border-s xl:border-divider">
            {GROUPS.map((g, i) => (
              <li key={g.id} className="min-w-0">
                <a
                  href={`#${g.id}`}
                  className="flex min-h-11 items-center gap-2 rounded-md px-2.5 type-label font-normal text-muted-foreground transition-colors duration-150 hover:bg-primary-soft/50 hover:text-foreground xl:-ms-px xl:min-h-9 xl:rounded-none xl:border-s-2 xl:border-transparent xl:hover:border-primary xl:hover:bg-transparent"
                  data-testid={`link-toc-${g.id}`}
                >
                  <span className="tabular type-caption text-gold-ink" aria-hidden><bdi>{formatNumber(i + 1, locale).padStart(2, '0')}</bdi></span>
                  {t(g.key)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          {/* 01 FOUNDATIONS */}
          <Group index={0}>
            <Specimen id="color" title={t('fd.color')} description={t('fd.colorBody')}>
              <div className="grid-cols-[minmax(0,1fr)] grid gap-x-10 gap-y-6 @2xl:grid-cols-2">
                {[
                  { k: 'f.color.brand' as const, items: [
                    { token: '--primary', label: t('f.color.gold') },
                    { token: '--gold-ink', label: t('f.color.goldInk'), ink: true },
                    { token: '--navy', label: t('f.color.navy') },
                  ] },
                  { k: 'f.color.canvasGroup' as const, items: [
                    { token: '--background', label: t('fd.color.canvas') },
                    { token: '--surface', label: t('fd.color.surface') },
                    { token: '--divider', label: t('f.color.divider') },
                  ] },
                  { k: 'f.color.text' as const, items: [
                    { token: '--foreground', label: t('fd.color.foreground'), ink: true },
                    { token: '--muted-foreground', label: t('fd.color.muted'), ink: true },
                  ] },
                  { k: 'f.color.semantic' as const, items: [
                    { token: '--success', label: t('fd.color.success'), ink: true },
                    { token: '--warning', label: t('fd.color.warning'), ink: true },
                    { token: '--destructive', label: t('fd.color.destructive'), ink: true },
                  ] },
                ].map((grp) => (
                  <div key={grp.k}>
                    <p className="pb-1 type-caption font-medium text-muted-foreground">{t(grp.k)}</p>
                    <ul className="divide-y divide-divider">
                      {grp.items.map((s) => <Swatch key={s.token} {...s} />)}
                    </ul>
                  </div>
                ))}
              </div>
            </Specimen>

            <Specimen id="type" title={t('fd.type')} description={t('fd.typeBody')}>
              <dl className="divide-y divide-divider">
                <div className="grid-cols-[minmax(0,1fr)] grid gap-2 py-4 @lg:grid-cols-[8rem_minmax(0,1fr)] @lg:items-baseline">
                  <dt className="flex flex-col type-caption text-muted-foreground"><span className="font-medium text-foreground">{t('f.type.hero')}</span><span dir="ltr" className="tabular text-start">32–48 / 600 / tnum</span></dt>
                  <dd><MoneyDisplay value={SPECIMEN.primary} size="hero" /></dd>
                </div>
                {[
                  { k: 'fd.type.title' as const, cls: 'type-display', spec: 'type-display · 26–32 / 600', txt: t('fd.type.sample') },
                  { k: 'fd.type.heading' as const, cls: 'type-title', spec: 'type-title · 18–19 / 600', txt: t('fd.type.sample') },
                  { k: 'fd.type.body' as const, cls: 'type-body', spec: 'type-body · 15 / 400', txt: t('fd.type.bodySample') },
                  { k: 'fd.type.caption' as const, cls: 'type-label font-normal text-muted-foreground', spec: 'type-label / type-caption', txt: t('fd.type.bodySample') },
                ].map((r) => (
                  <div key={r.k} className="grid-cols-[minmax(0,1fr)] grid gap-2 py-4 @lg:grid-cols-[8rem_minmax(0,1fr)] @lg:items-baseline">
                    <dt className="flex flex-col type-caption text-muted-foreground">
                      <span className="font-medium text-foreground">{t(r.k)}</span>
                      <span dir="ltr" className="tabular text-start">{r.spec}</span>
                    </dt>
                    <dd className={r.cls}>{r.txt}</dd>
                  </div>
                ))}
                <div className="grid-cols-[minmax(0,1fr)] grid gap-2 py-4 @lg:grid-cols-[8rem_minmax(0,1fr)] @lg:items-baseline">
                  <dt className="flex flex-col type-caption text-muted-foreground"><span className="font-medium text-foreground">{t('f.type.arabic')}</span><span dir="ltr" className="text-start">Noto Sans Arabic · 1.7</span></dt>
                  <dd lang="ar" dir="rtl" className="font-arabic type-title font-normal">رصيدك المتاح يكفي حتى نهاية الشهر، ويبقى منه <bdi dir="ltr" className="tabular">₪415.30</bdi> تقريبًا.</dd>
                </div>
              </dl>
            </Specimen>

            <Specimen id="spacing" title={t('fd.spacing')} description={t('fd.spacingBody')}>
              <div className="flex flex-wrap items-end gap-3" dir="ltr">
                {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-2">
                    <span className="rounded-[3px] bg-foreground/15" style={{ width: n * 4, height: n * 4 }} aria-hidden />
                    <span className="tabular type-caption text-muted-foreground">{n * 4}</span>
                  </div>
                ))}
              </div>
            </Specimen>

            <Specimen id="radii" title={t('f.radii')} description={t('f.radiiBody')}>
              <div className="flex flex-wrap items-end gap-5" dir="ltr">
                {[{ r: 'rounded-sm', l: '8' }, { r: 'rounded-[10px]', l: '10' }, { r: 'rounded-lg', l: '12' }, { r: 'rounded-xl', l: '16' }, { r: 'rounded-full', l: 'pill' }].map((x) => (
                  <div key={x.l} className="flex flex-col items-center gap-2">
                    <div className={cn('size-14 border border-input bg-surface', x.r)} aria-hidden />
                    <span className="tabular type-caption text-muted-foreground">{x.l}</span>
                  </div>
                ))}
              </div>
            </Specimen>

            <Specimen id="elevation" title={t('f.elevation')} description={t('f.elevationBody')}>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 @xl:grid-cols-[repeat(4,minmax(0,1fr))]">
                <div className="flex h-20 items-end rounded-lg bg-background p-3 type-caption text-muted-foreground ring-1 ring-inset ring-divider">{t('f.elev.canvas')}</div>
                <div className="flex h-20 items-end border-t border-divider p-3 type-caption text-muted-foreground">{t('f.elev.section')}</div>
                <div className="flex h-20 items-end rounded-lg border border-card-border bg-surface p-3 type-caption text-muted-foreground">{t('f.elev.raised')}</div>
                <div className="flex h-20 items-end rounded-lg border border-popover-border bg-popover p-3 type-caption text-muted-foreground shadow-lg">{t('f.elev.overlay')}</div>
              </div>
            </Specimen>

            <Specimen id="icons" title={t('f.icons')} description={t('f.iconsBody')}>
              <ul className="flex flex-wrap gap-5 text-foreground/80" aria-hidden>
                {ICONS.map((I, i) => <li key={i}><I className="size-5" strokeWidth={1.75} /></li>)}
              </ul>
            </Specimen>
          </Group>

          {/* 02 ACTIONS */}
          <Group index={1}>
            <Specimen title={t('fd.actions')} description={t('fd.actionsBody')}><ActionsSpecimen /></Specimen>
          </Group>

          {/* 03 INPUTS */}
          <Group index={2}>
            <Specimen id="forms" title={t('i.text')} description={t('fd.formsBody')}><FormSpecimen /></Specimen>
            <Specimen title={t('i.choice')}><ChoiceSpecimen /></Specimen>
            <Specimen title={t('i.validation')}><ValidationSpecimen /></Specimen>
          </Group>

          {/* 04 FINANCIAL */}
          <Group index={3}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-divider py-3">
              <SpecimenTag label={t('spec.note')} />
              <div className="flex items-center gap-3">
                <Label htmlFor="hide-amounts" className="type-label flex min-h-11 cursor-pointer items-center font-normal">{t('fd.money.hidden')}</Label>
                <Switch id="hide-amounts" checked={hidden} onCheckedChange={setHidden} data-testid="switch-hide-amounts" />
              </div>
            </div>

            <Specimen id="balance" title={t('fin.balance')}>
              <BalanceDisplay
                label={t('fin.balanceLabel')}
                amount={SPECIMEN.primary}
                tag={tag}
                note={t('fin.balanceNote')}
                hidden={hidden}
                hiddenLabel={hiddenLabel}
                testId="text-specimen-primary-amount"
                actions={
                  <>
                    <Button data-testid="button-specimen-fin-primary" disabled>{t('hs.act.save')}</Button>
                    <span className="type-label font-normal text-muted-foreground">{t('hs.act.payNote')}</span>
                  </>
                }
              />
            </Specimen>

            <Specimen id="money" title={t('fin.amounts')} description={t('fd.moneyBody')}>
              <dl className="divide-y divide-divider border-y border-divider">
                {[
                  { k: 'fin.highlight' as const, v: SPECIMEN.account, tone: 'highlight' as const },
                  { k: 'fin.positive' as const, v: SPECIMEN.inflow, tone: 'positive' as const, plus: true },
                  { k: 'fin.negative' as const, v: SPECIMEN.outflow, tone: 'negative' as const },
                  { k: 'fin.neutral' as const, v: SPECIMEN.neutral, tone: 'neutral' as const },
                  { k: 'fin.planned' as const, v: SPECIMEN.planned, tone: 'planned' as const },
                  { k: 'fin.projected' as const, v: SPECIMEN.projected, tone: 'projected' as const },
                ].map((r) => (
                  <div key={r.k} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
                    <dt className="type-label font-normal text-muted-foreground">{t(r.k)}</dt>
                    <dd className="shrink-0"><MoneyDisplay value={r.v} size="md" className="text-[17px]" tone={r.tone} showPlus={r.plus} hidden={hidden} hiddenLabel={hiddenLabel} /></dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2 pt-6">
                <span className="type-label font-normal text-muted-foreground">{t('fd.money.currencies')}</span>
                <ul className="flex flex-wrap gap-x-8 gap-y-2">
                  {CURRENCIES.map((c) => (
                    <li key={c} className="flex items-baseline gap-2">
                      <span className="font-mono type-caption text-muted-foreground">{c}</span>
                      <MoneyDisplay value={SPECIMEN.perCurrency[c]} hidden={hidden} hiddenLabel={hiddenLabel} />
                    </li>
                  ))}
                </ul>
              </div>
            </Specimen>

            <Specimen id="summary" title={t('fin.summary')}>
              <FinancialSummary
                hidden={hidden}
                hiddenLabel={hiddenLabel}
                testId="summary-specimen"
                items={[
                  { id: 'in', label: t('fd.money.inflow'), value: SPECIMEN.inflow, tone: 'positive', showPlus: true },
                  { id: 'out', label: t('fd.money.outflow'), value: SPECIMEN.outflow },
                  { id: 'planned', label: t('fin.planned'), value: SPECIMEN.planned, tone: 'planned' },
                  { id: 'projected', label: t('fin.projected'), value: SPECIMEN.projected, tone: 'projected' },
                ]}
              />
            </Specimen>

            <Specimen id="txn" title={t('fd.txn')} description={t('fd.txnBody')}>
              <ul className="divide-y divide-divider border-y border-divider">
                <TransactionRow title={t('fd.txn.a')} meta={t('fd.txn.aMeta')} amount={SPECIMEN.outflow} date={SPECIMEN.date} direction="out" directionLabel={t('fd.txn.out')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-1" />
                <TransactionRow title={t('fd.txn.b')} meta={t('fd.txn.bMeta')} amount={SPECIMEN.inflow} date={SPECIMEN.date} direction="in" directionLabel={t('fd.txn.in')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-2" />
                <TransactionRow title={t('fd.txn.c')} meta={t('fd.txn.cMeta')} amount={SPECIMEN.pending} date={SPECIMEN.date} direction="pending" directionLabel={t('fd.txn.cMeta')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-3" />
              </ul>
            </Specimen>

            <Specimen id="upcoming" title={t('fin.upcoming')}>
              <ul className="divide-y divide-divider border-y border-divider">
                <UpcomingPayment title={t('hs.up.phone')} meta={t('hs.up.phoneMeta')} due={SPECIMEN.due} amount={SPECIMEN.upcoming} statusTone="info" statusLabel={t('hs.status.scheduled')} hidden={hidden} hiddenLabel={hiddenLabel} testId="row-specimen-upcoming" />
              </ul>
            </Specimen>

            <Specimen id="progress" title={t('fd.progress')} description={t('fd.progressBody')}>
              <div className="flex max-w-lg flex-col gap-8">
                <ProgressMeter kind="savings" value={SPECIMEN.savedOf.saved.minor / SPECIMEN.savedOf.target.minor} label={t('fin.savings')} statusLabel={t('fd.progress.on')} detail={t('hs.sv.of', { saved: formatMoney(SPECIMEN.savedOf.saved, locale), target: formatMoney(SPECIMEN.savedOf.target, locale) })} />
                <ProgressMeter kind="budget" value={SPECIMEN.budgetOf.spent.minor / SPECIMEN.budgetOf.plan.minor} label={t('fin.budget')} statusLabel={t('fd.progress.on')} detail={t('hs.sv.of', { saved: formatMoney(SPECIMEN.budgetOf.spent, locale), target: formatMoney(SPECIMEN.budgetOf.plan, locale) })} />
                <ProgressMeter kind="budget" value={1.12} status="over" label={t('fin.budget')} statusLabel={t('fin.over')} />
                <div className="flex flex-col gap-4 border-t border-divider pt-6">
                  <ProgressMeter kind="savings" value={p} label={t('fd.progress.label')} status={status} statusLabel={statusLabel} />
                  <Label id="progress-adjust" className="type-label font-normal text-muted-foreground">{t('fd.progress.adjust')}</Label>
                  <Slider aria-labelledby="progress-adjust" value={[progress]} min={0} max={100} step={1} onValueChange={([v]) => setProgress(v)} data-testid="slider-progress" />
                </div>
              </div>
            </Specimen>

            <Specimen id="account" title={t('fd.account')} description={t('fd.accountBody')}>
              <div className="grid-cols-[minmax(0,1fr)] grid gap-4 @2xl:grid-cols-2">
                <AccountSurface name={t('fd.account.name')} kind={t('fd.account.kind')} amount={SPECIMEN.account} meta={t('fd.account.meta', { date: specimenDate })} badge={<SpecimenTag label={t('spec.tag')} />} icon={<Landmark />} hidden={hidden} hiddenLabel={hiddenLabel} emphasis testId="surface-specimen-account-1" />
                <AccountSurface name={t('fd.account.name')} kind={t('fd.account.kind2')} amount={SPECIMEN.account2} meta={t('fd.account.meta', { date: specimenDate })} badge={<SpecimenTag label={t('spec.tag')} />} icon={<PiggyBank />} hidden={hidden} hiddenLabel={hiddenLabel} testId="surface-specimen-account-2" />
              </div>
            </Specimen>

            <Specimen id="badges" title={t('fin.status')} description={t('fd.badgesBody')}>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="neutral" label={t('fd.badge.neutral')} />
                <StatusBadge tone="info" label={t('fd.badge.info')} />
                <StatusBadge tone="success" label={t('fd.badge.success')} />
                <StatusBadge tone="warning" label={t('fd.badge.warning')} />
                <StatusBadge tone="error" label={t('fd.badge.error')} />
              </div>
            </Specimen>
          </Group>

          {/* 05 FEEDBACK */}
          <Group index={4}>
            <Specimen title={t('fb.notices')}>
              <div className="grid-cols-[minmax(0,1fr)] grid gap-6 @2xl:grid-cols-2">
                <Notice tone="success" title={t('fb.success')} body={t('fb.successBody')} />
                <Notice tone="warning" title={t('fb.warning')} body={t('fb.warningBody')} />
                <Notice tone="error" title={t('fb.error')} body={t('fb.errorBody')} />
                <Notice tone="info" title={t('fb.info')} body={t('fb.infoBody')} />
              </div>
            </Specimen>
            <Specimen id="states" title={t('fb.states')} description={t('fd.statesBody')}><StatesSpecimen /></Specimen>
          </Group>

          {/* 06 OVERLAYS */}
          <Group index={5}>
            <Specimen title={t('ov.dialog')} description={t('fd.overlaysBody')}><DestructiveConfirm label={t('fd.dlg.open')} /></Specimen>
            <Specimen title={t('ov.sheet')}><SheetSpecimen /></Specimen>
            <Specimen title={t('ov.review')}><ReviewSpecimen /></Specimen>
            <Specimen title={t('ov.menu')}><MenuSpecimen /></Specimen>
          </Group>

          {/* 07 NAVIGATION */}
          <Group index={6}>
            <Specimen title={t('nv.sidebar')} description={t('nv.sidebarBody')}><SidebarSpecimen /></Specimen>
            <Specimen title={t('nv.bottom')}><BottomNavSpecimen /></Specimen>
            <Specimen title={t('nv.tabs')}><TabsSpecimen /></Specimen>
            <Specimen title={t('nv.crumbs')}><CrumbsSpecimen /></Specimen>
          </Group>
        </div>
      </div>
    </Page>
  );
}
