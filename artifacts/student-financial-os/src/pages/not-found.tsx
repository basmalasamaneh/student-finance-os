import { Link, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Page } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';

export default function NotFound() {
  const { t } = useI18n();
  const [location] = useLocation();
  return (
    <Page>
      <div className="stagger flex max-w-2xl flex-col gap-5 py-6 md:py-12" data-testid="state-not-found">
        <p className="tabular text-[64px] font-semibold leading-none tracking-tight text-primary/40 md:text-[96px]" aria-hidden>404</p>
        <p className="text-[13px] font-medium tracking-wide text-gold-ink">{t('nf.eyebrow')}</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-4xl" data-testid="text-page-title">{t('nf.title')}</h1>
        <p className="text-base leading-7 text-muted-foreground">{t('nf.body')}</p>
        <p className="text-sm text-muted-foreground">
          {t('nf.path')}: <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{location}</code>
        </p>
        <div className="pt-3">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="link-nf-home">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {t('ni.back')}
          </Link>
        </div>
      </div>
    </Page>
  );
}
