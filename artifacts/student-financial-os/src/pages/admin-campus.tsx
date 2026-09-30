import { useState } from 'react';
import { Building2, MapPin, Pencil, Plus } from 'lucide-react';
import { getListCampusCatalogQueryKey, useListCampusCatalog, type CampusService } from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { AdminCatalogDialog, type AdminTarget } from '@/components/campus/admin-forms';
import { FutureIntegrations } from '@/components/campus/future-integrations';
import { useAccount } from '@/features/auth/account';
import { CATEGORY_LABEL, label, useTx, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';

const Pill = ({ on, children }: { on: boolean; children: string }) => (
  <span className={cn('type-caption rounded-full px-2 py-0.5 font-medium', on ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>{children}</span>
);

function IntegrationStatus({ t }: { t: Tx }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t('Integration status', 'حالة التكامل')}>
      <span className="type-caption rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 font-medium text-gold-ink">{t('Simulated', 'محاكاة')}</span>
      <span aria-disabled="true" title={t('Not available in the prototype', 'غير متاح في النموذج')} className="type-caption rounded-full border border-dashed border-input px-2 py-0.5 text-muted-foreground">{t('Connected · coming soon', 'متصل · قريباً')}</span>
    </div>
  );
}

function ServiceBlock({ s, onEdit, t }: { s: CampusService; onEdit: (target: AdminTarget) => void; t: Tx }) {
  return (
    <li className="flex flex-col gap-3 py-4" data-testid={`row-admin-service-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-subtitle">{s.name} <span className="font-normal text-muted-foreground" lang="ar" dir="rtl">· {s.arabicName}</span></p>
          <p className="type-caption text-muted-foreground">{label(CATEGORY_LABEL, s.category, t)}{s.location ? <> · <MapPin className="inline size-3" aria-hidden /> {s.location}</> : null}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Pill on={s.active}>{s.active ? t('Active', 'نشطة') : t('Inactive', 'غير نشطة')}</Pill>
            <Pill on={s.paymentEnabled}>{s.paymentEnabled ? t('Payments on', 'الدفع مفعّل') : t('Payments off', 'الدفع متوقف')}</Pill>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <IntegrationStatus t={t} />
          <Button size="sm" variant="outline" onClick={() => onEdit({ kind: 'service', campusId: s.campusId, service: s })} data-testid={`button-edit-service-${s.id}`}><Pencil aria-hidden />{t('Edit', 'تعديل')}</Button>
        </div>
      </div>
      <ul className="divide-y divide-divider rounded-xl bg-surface-sunken px-3">
        {s.products.map((p) => (
          <li key={p.id} className="flex min-w-0 items-center gap-3 py-2" data-testid={`row-admin-product-${p.id}`}>
            <span className={cn('type-label min-w-0 flex-1', !p.active && 'text-muted-foreground line-through')}>{p.name} <span className="text-muted-foreground" lang="ar" dir="rtl">· {p.arabicName}</span></span>
            <MoneyDisplay value={p.price} size="sm" />
            <Button size="icon" variant="ghost" className="size-9" onClick={() => onEdit({ kind: 'product', serviceId: s.id, product: p })} aria-label={t(`Edit ${p.name}`, `تعديل ${p.arabicName}`)} data-testid={`button-edit-product-${p.id}`}><Pencil aria-hidden /></Button>
          </li>
        ))}
        <li className="py-1"><Button size="sm" variant="ghost" onClick={() => onEdit({ kind: 'product', serviceId: s.id })} data-testid={`button-add-product-${s.id}`}><Plus aria-hidden />{t('Add item', 'إضافة عنصر')}</Button></li>
      </ul>
    </li>
  );
}

export default function AdminCampusPage() {
  const t = useTx();
  const me = useAccount();
  const q = useListCampusCatalog({ query: { queryKey: getListCampusCatalogQueryKey(), enabled: me.role === 'admin' } });
  const [target, setTarget] = useState<AdminTarget | null>(null);

  if (me.role !== 'admin') return <Page><StatePanel tone="permission" title={t('Admins only', 'للمشرفين فقط')} body={t('The campus catalog is managed by administrators.', 'يدير المشرفون الكتالوج الجامعي.')} /></Page>;

  return (
    <Page>
      <PageHeader eyebrow={t('ADMIN · CAMPUS CATALOG', 'إدارة · الكتالوج الجامعي')} title={t('Institutions & campus services', 'المؤسسات والخدمات الجامعية')}
        lede={t('Configure universities, campuses, merchants and demo prices. All payments are simulated; no real institution is connected.', 'اضبط الجامعات والأحرام والتجار والأسعار التجريبية. كل المدفوعات محاكاة؛ لا توجد مؤسسة حقيقية متصلة.')}
        actions={<Button onClick={() => setTarget({ kind: 'university' })} data-testid="button-add-university"><Plus aria-hidden />{t('Add university', 'إضافة جامعة')}</Button>} />

      {q.isPending ? <SkeletonRows rows={4} label={t('Loading catalog…', 'جارٍ تحميل الكتالوج…')} />
        : q.isError ? <StatePanel tone="error" title={t('Catalog did not load', 'تعذّر تحميل الكتالوج')} body={t('Try again in a moment.', 'حاول بعد قليل.')} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={q.isRefetching} onClick={() => q.refetch()} />} />
          : !q.data.length ? <StatePanel tone="empty" icon={<Building2 className="size-[18px]" aria-hidden />} title={t('No universities configured', 'لا جامعات مُعدّة')} body={t('Add a fictional university to begin. Students can also load the demo catalog from Campus.', 'أضف جامعة وهمية للبدء. يمكن للطلاب أيضاً تحميل الكتالوج التجريبي من صفحة الحرم.')} />
            : (
              <div className="flex flex-col gap-10">
                {q.data.map((u) => (
                  <section key={u.id} className="flex flex-col gap-4 border-t border-divider pt-6" data-testid={`section-university-${u.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="type-title">{u.name} <span className="font-normal text-muted-foreground" lang="ar" dir="rtl">· {u.arabicName}</span></h2>
                      <Button size="sm" variant="outline" onClick={() => setTarget({ kind: 'campus', universityId: u.id })} data-testid={`button-add-campus-${u.id}`}><Plus aria-hidden />{t('Add campus', 'إضافة حرم')}</Button>
                    </div>
                    {u.campuses.length ? u.campuses.map((c) => (
                      <div key={c.id} className="flex flex-col gap-1 ps-3 sm:ps-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="type-subtitle inline-flex items-center gap-1.5"><MapPin className="size-4 text-gold-ink" aria-hidden />{c.name} <span className="font-normal text-muted-foreground" lang="ar" dir="rtl">· {c.arabicName}</span></h3>
                          <Button size="sm" variant="ghost" onClick={() => setTarget({ kind: 'service', campusId: c.id })} data-testid={`button-add-service-${c.id}`}><Plus aria-hidden />{t('Add service', 'إضافة خدمة')}</Button>
                        </div>
                        {c.services.length ? <ul className="divide-y divide-divider">{c.services.map((s) => <ServiceBlock key={s.id} s={s} onEdit={setTarget} t={t} />)}</ul>
                          : <p className="type-caption py-2 text-muted-foreground">{t('No services yet.', 'لا خدمات بعد.')}</p>}
                      </div>
                    )) : <p className="type-caption text-muted-foreground">{t('No campuses yet.', 'لا أحرام بعد.')}</p>}
                  </section>
                ))}
              </div>
            )}

      <section className="mt-12 flex flex-col gap-3 border-t border-divider pt-8">
        <h2 className="type-title">{t('Integrations', 'التكاملات')}</h2>
        <p className="type-caption max-w-xl text-muted-foreground">{t('There are no real connections to toggle. These rails are planned and stay disabled.', 'لا توجد اتصالات حقيقية لتفعيلها. هذه القنوات مخططة وتبقى معطلة.')}</p>
        <FutureIntegrations t={t} />
      </section>

      <AdminCatalogDialog target={target} onClose={() => setTarget(null)} t={t} />
    </Page>
  );
}
