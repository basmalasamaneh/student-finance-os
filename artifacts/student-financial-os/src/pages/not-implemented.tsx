import { Link } from 'wouter';
import { ArrowLeft, Construction } from 'lucide-react';
import { Page } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import type { NavItem } from '@/features/navigation/nav-config';

/** The ONE shared state for every planned-but-unbuilt destination. No fake functionality. */
export default function NotImplementedPage({ item }: { item: NavItem }) {
  const { t } = useI18n();
  const { role, mode } = usePreview();
  const feature = t(mode === 'school' && item.schoolLabelKey ? item.schoolLabelKey : item.labelKey);
  const Icon = item.icon;
  return (
    <Page>
      <div className="stagger flex max-w-2xl flex-col gap-5 py-6 md:py-12" data-testid="state-not-implemented">
        <div className="relative w-fit">
          <span className="grid size-14 place-items-center rounded-2xl border border-dashed border-input text-muted-foreground" aria-hidden>
            <Icon className="size-6" />
          </span>
          <span className="absolute -bottom-1.5 -end-1.5 grid size-6 place-items-center rounded-full bg-warning-soft text-warning ring-4 ring-background" aria-hidden>
            <Construction className="size-3.5" />
          </span>
        </div>
        <p className="text-[13px] font-medium tracking-wide text-warning">{t('ni.eyebrow')}</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-4xl" data-testid="text-page-title">
          {t('ni.title', { feature })}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{t('ni.body')}</p>
        <p className="text-sm text-muted-foreground">{t('ni.forRole', { role: t(`role.${role}`) })}</p>
        <div className="flex flex-wrap gap-3 pt-3">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="link-ni-home">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {t('ni.back')}
          </Link>
          <Link href="/foundation" className="inline-flex min-h-10 items-center rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted" data-testid="link-ni-foundation">
            {t('ni.explore')}
          </Link>
        </div>
      </div>
    </Page>
  );
}
