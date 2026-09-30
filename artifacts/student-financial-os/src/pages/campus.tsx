import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { BookOpen, Bus, Coffee, Landmark, MapPin, Minus, Plus, Printer, ShoppingBag, Store } from 'lucide-react';
import {
  getListCampusCatalogQueryKey, getListFinanceAccountsQueryKey, useInstallCampusDemo, useListCampusCatalog, useListFinanceAccounts,
  type CampusService,
} from '@workspace/api-client-react';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Notice, RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { CheckoutDialog, type CartLine } from '@/components/campus/checkout-dialog';
import { FutureIntegrations } from '@/components/campus/future-integrations';
import { useAccount } from '@/features/auth/account';
import { apiErrorText, CATEGORY_LABEL, exactLine, exactSum, label, useRefreshFinance, useTx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';
import type { Currency, Money } from '@/lib/money';

const SERVICE_ICON: Record<string, typeof Coffee> = { food: Coffee, books: BookOpen, printing: Printer, transportation: Bus, fees: Landmark, other: Store };

const chip = (active: boolean) => cn('type-label min-h-11 rounded-full border px-4 transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted');

export default function CampusPage() {
  const t = useTx();
  const me = useAccount();
  const catalogQ = useListCampusCatalog({ query: { queryKey: getListCampusCatalogQueryKey() } });
  const accountsQ = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey() } });
  const install = useInstallCampusDemo();
  const refresh = useRefreshFinance();
  const [uniId, setUniId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [paid, setPaid] = useState(false);

  const catalog = useMemo(() => catalogQ.data ?? [], [catalogQ.data]);
  const uni = catalog.find((u) => u.id === uniId) ?? catalog[0];
  const campus = uni?.campuses.find((c) => c.id === campusId) ?? uni?.campuses[0];
  const services = useMemo(() => (campus?.services ?? []).filter((s) => s.active), [campus]);
  const service: CampusService | undefined = services.find((s) => s.id === serviceId);

  useEffect(() => { setCart({}); }, [serviceId]);

  const lines: CartLine[] = useMemo(() => (service?.products ?? []).filter((p) => p.active && (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: cart[p.id]! })), [service, cart]);
  const currencies = new Set(lines.map((l) => l.product.price.currency));
  const lineTotals = lines.map((l) => exactLine(l.product.price, l.quantity));
  const overflow = lineTotals.some((v) => !v);
  const total: Money | null = lines.length && currencies.size === 1 && !overflow
    ? exactSum(lineTotals as Money[], lines[0]!.product.price.currency as Currency) : null;
  const setQty = (id: string, q: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(100, q)) }));
  const name = (x: { name: string; arabicName: string }) => t(x.name, x.arabicName);

  if (me.role !== 'student') return <Page><StatePanel tone="permission" title={t('Campus payments are for students', 'المدفوعات الجامعية للطلاب')} body={t('Admins manage the catalog from Institutions.', 'يدير المشرفون الكتالوج من صفحة المؤسسات.')} /></Page>;

  return (
    <Page>
      <PageHeader eyebrow={t('CAMPUS · SIMULATED', 'الحرم · محاكاة')} title={t('Campus payments', 'المدفوعات الجامعية')}
        lede={t('Pay cafeterias, bookstores and printing centers from your Student Wallet. Every payment is simulated and recorded with a receipt.', 'ادفع للكافتيريا والمكتبة ومركز الطباعة من محفظتك الطلابية. كل دفعة محاكاة وتُسجَّل بإيصال.')} />

      {catalogQ.isPending ? <SkeletonRows rows={4} label={t('Loading campus catalog…', 'جارٍ تحميل الكتالوج…')} />
        : catalogQ.isError ? <StatePanel tone="error" title={t('Catalog did not load', 'تعذّر تحميل الكتالوج')} body={t('Try again in a moment.', 'حاول بعد قليل.')} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={catalogQ.isRefetching} onClick={() => catalogQ.refetch()} />} />
          : !catalog.length ? (
            <StatePanel tone="empty" icon={<ShoppingBag className="size-[18px]" aria-hidden />} title={t('No campus catalog yet', 'لا يوجد كتالوج بعد')}
              body={t('Load the fictional demo university to try the flow. It contains made-up merchants and demo prices, not a real institution.', 'حمّل الجامعة التجريبية الوهمية لتجربة التدفق. تحتوي تجاراً وأسعاراً تجريبية، وليست مؤسسة حقيقية.')}
              action={<div className="flex flex-col items-start gap-2">
                <Button disabled={install.isPending} aria-busy={install.isPending} onClick={() => install.mutate(undefined, { onSuccess: () => void refresh() })} data-testid="button-install-demo">{install.isPending ? t('Loading…', 'جارٍ التحميل…') : t('Load demo catalog', 'تحميل الكتالوج التجريبي')}</Button>
                {install.isError ? <p role="alert" className="type-caption text-destructive">{apiErrorText(install.error, t)}</p> : null}
              </div>} />
          ) : (
            <div className="flex flex-col gap-10">
              <section className="flex flex-col gap-4" aria-labelledby="where-title">
                <h2 id="where-title" className="type-subtitle">{t('1 · University and campus', '١ · الجامعة والحرم')}</h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('University', 'الجامعة')}>
                  {catalog.map((u) => <button key={u.id} type="button" aria-pressed={uni?.id === u.id} className={chip(uni?.id === u.id)} onClick={() => { setUniId(u.id); setCampusId(''); setServiceId(''); }} data-testid={`button-university-${u.id}`}>{name(u)}</button>)}
                </div>
                {uni && uni.campuses.length > 1 ? (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t('Campus', 'الحرم')}>
                    {uni.campuses.map((c) => <button key={c.id} type="button" aria-pressed={campus?.id === c.id} className={chip(campus?.id === c.id)} onClick={() => { setCampusId(c.id); setServiceId(''); }} data-testid={`button-campus-${c.id}`}>{name(c)}</button>)}
                  </div>
                ) : campus ? <p className="type-caption inline-flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" aria-hidden />{name(campus)}</p> : null}
              </section>

              <section className="flex flex-col gap-3" aria-labelledby="svc-title">
                <h2 id="svc-title" className="type-subtitle">{t('2 · Service', '٢ · الخدمة')}</h2>
                {services.length ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => {
                      const Icon = SERVICE_ICON[s.category] ?? Store;
                      const active = s.id === serviceId;
                      return (
                        <li key={s.id}>
                          <button type="button" disabled={!s.paymentEnabled} aria-pressed={active} onClick={() => setServiceId(s.id)} data-testid={`button-service-${s.id}`}
                            className={cn('flex h-full w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60', active ? 'border-primary bg-primary-soft' : 'border-card-border bg-card hover:bg-muted')}>
                            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-gold-ink')}><Icon className="size-[18px]" aria-hidden /></span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="type-subtitle">{name(s)}</span>
                              <span className="type-caption text-muted-foreground">{label(CATEGORY_LABEL, s.category, t)}{s.location ? ` · ${s.location}` : ''}</span>
                              {!s.paymentEnabled ? <span className="type-caption text-warning">{t('Payments paused', 'الدفع متوقف')}</span> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <StatePanel tone="empty" className="py-4" title={t('No active services', 'لا خدمات نشطة')} body={t('This campus has no services open right now.', 'لا توجد خدمات مفتوحة في هذا الحرم الآن.')} />}
              </section>

              {service ? (
                <section className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]" aria-labelledby="items-title">
                  <div className="flex flex-col gap-2">
                    <h2 id="items-title" className="type-subtitle">{t('3 · Items', '٣ · العناصر')}</h2>
                    {service.description ? <p className="type-caption text-muted-foreground">{service.description}</p> : null}
                    <ul className="divide-y divide-divider border-y border-divider" data-testid="list-products">
                      {service.products.filter((p) => p.active).map((p) => {
                        const q = cart[p.id] ?? 0;
                        return (
                          <li key={p.id} className="flex min-w-0 items-center gap-3 py-3" data-testid={`row-product-${p.id}`}>
                            <span className="flex min-w-0 flex-1 flex-col"><span className="type-label">{name(p)}</span><MoneyDisplay value={p.price} size="sm" tone="muted" /></span>
                            <div className="flex items-center gap-1" role="group" aria-label={t(`Quantity of ${p.name}`, `كمية ${p.arabicName}`)}>
                              <Button size="icon" variant="outline" className="size-9" disabled={!q} onClick={() => setQty(p.id, q - 1)} aria-label={t('Decrease', 'إنقاص')} data-testid={`button-dec-${p.id}`}><Minus aria-hidden /></Button>
                              <span className="tabular w-7 text-center text-sm font-semibold" aria-live="polite" data-testid={`text-qty-${p.id}`}>{q}</span>
                              <Button size="icon" variant="outline" className="size-9" disabled={q >= 100} onClick={() => setQty(p.id, q + 1)} aria-label={t('Increase', 'زيادة')} data-testid={`button-inc-${p.id}`}><Plus aria-hidden /></Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {!service.products.some((p) => p.active) ? <p className="type-caption text-muted-foreground">{t('No items available.', 'لا عناصر متاحة.')}</p> : null}
                  </div>
                  <aside className="flex flex-col gap-3 md:sticky md:top-6 md:self-start" aria-labelledby="cart-title">
                    <h2 id="cart-title" className="type-subtitle">{t('4 · Cart', '٤ · السلة')}</h2>
                    {lines.length ? (
                      <div className="flex flex-col gap-3 rounded-xl bg-surface-sunken p-4">
                        {lines.map((l, i) => <div key={l.product.id} className="type-caption flex justify-between gap-2"><span>{name(l.product)} × <bdi className="tabular">{l.quantity}</bdi></span>{lineTotals[i] ? <MoneyDisplay value={lineTotals[i]!} size="sm" /> : <span className="text-destructive">—</span>}</div>)}
                        <div className="flex items-baseline justify-between border-t border-divider pt-3"><span className="type-label">{t('Total', 'الإجمالي')}</span>{total ? <MoneyDisplay value={total} size="lg" testId="text-cart-total" /> : null}</div>
                        {overflow || (currencies.size === 1 && lines.length > 0 && !total) ? <Notice tone="error" title={t('Amount too large', 'المبلغ كبير جداً')} body={t('This cart total cannot be represented exactly. Reduce quantities.', 'لا يمكن تمثيل إجمالي السلة بدقة. قلّل الكميات.')} /> : null}
                        {currencies.size > 1 ? <Notice tone="error" title={t('Mixed currencies', 'عملات مختلطة')} body={t('Pay items of one currency at a time.', 'ادفع لعناصر عملة واحدة في كل مرة.')} /> : null}
                        <Button disabled={!total} onClick={() => setCheckout(true)} data-testid="button-checkout">{t('Continue to payment', 'متابعة للدفع')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setCart({})}>{t('Clear cart', 'إفراغ السلة')}</Button>
                      </div>
                    ) : <p className="type-caption text-muted-foreground">{t('Add items to review your cart.', 'أضف عناصر لمراجعة السلة.')}</p>}
                  </aside>
                </section>
              ) : null}

              {accountsQ.data && !accountsQ.data.length ? <Notice tone="info" title={t('You need an account to pay', 'تحتاج حساباً للدفع')} body={t('Create a Student Wallet on the Money page first.', 'أنشئ محفظة طلابية في صفحة المال أولاً.')} /> : null}
              {accountsQ.data && !accountsQ.data.length ? <Link href="/money" className="type-label -mt-6 text-gold-ink underline-offset-4 hover:underline" data-testid="link-go-money">{t('Go to Money', 'الذهاب إلى المال')}</Link> : null}
            </div>
          )}

      <section className="mt-12 flex flex-col gap-3 border-t border-divider pt-8">
        <SectionHeading id="future" title={t('Future payment rails', 'قنوات دفع مستقبلية')} meta={t('Not connected', 'غير متصلة')} />
        <p className="type-caption max-w-xl text-muted-foreground">{t('The prototype only records simulated payments. These integrations are planned and are not active.', 'النموذج الأولي يسجل مدفوعات محاكاة فقط. هذه التكاملات مخططة وغير مفعّلة.')}</p>
        <FutureIntegrations t={t} />
      </section>

      {service && total ? (
        <CheckoutDialog open={checkout} onOpenChange={(o) => { setCheckout(o); if (!o && paid) { setCart({}); setPaid(false); } }} service={service} lines={lines} total={total} accounts={accountsQ.data ?? []} serviceName={name(service)} onPaid={() => setPaid(true)} t={t} />
      ) : null}
    </Page>
  );
}
