import { Link } from 'wouter';
import { Accessibility, ArrowRight, Coins, Languages, Layers, LayoutPanelLeft, ListChecks } from 'lucide-react';
import { Page } from '@/components/layout/page';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/features/theme/theme-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import type { TranslationKey } from '@/features/i18n/dictionary';

const READY: { icon: typeof Layers; title: TranslationKey; body: TranslationKey }[] = [
  { icon: Layers, title: 'home.ready.tokens', body: 'home.ready.tokensBody' },
  { icon: LayoutPanelLeft, title: 'home.ready.shell', body: 'home.ready.shellBody' },
  { icon: Languages, title: 'home.ready.i18n', body: 'home.ready.i18nBody' },
  { icon: ListChecks, title: 'home.ready.states', body: 'home.ready.statesBody' },
  { icon: Coins, title: 'home.ready.money', body: 'home.ready.moneyBody' },
  { icon: Accessibility, title: 'home.ready.a11y', body: 'home.ready.a11yBody' },
];

export default function HomePage() {
  const { t, lang } = useI18n();
  const { theme, resolved } = useTheme();
  const { role } = usePreview();

  return (
    <Page>
      <header className="stagger flex flex-col gap-5 pb-12 md:pb-16">
        <p className="inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-primary">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--mint-raw))] opacity-60" />
            <span className="relative size-2 rounded-full bg-[hsl(var(--mint-raw))]" />
          </span>
          {t('home.eyebrow')}
        </p>
        <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.1] tracking-tight md:text-[52px]" data-testid="text-page-title">
          {t('home.title')}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">{t('home.lede')}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/foundation" className="group inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-transform active:scale-[0.98]" data-testid="link-cta-foundation">
            {t('home.cta.foundation')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
          </Link>
          <Link href="/appearance" className="inline-flex min-h-11 items-center rounded-md border border-input px-5 text-[15px] font-medium transition-colors hover:bg-muted" data-testid="link-cta-appearance">
            {t('home.cta.appearance')}
          </Link>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm" data-testid="text-foundation-context">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('home.meta.language')}</dt>
            <dd className="font-medium">{lang === 'ar' ? t('lang.arabic') : t('lang.english')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('home.meta.theme')}</dt>
            <dd className="font-medium">
              {t(`theme.${theme}`)}
              {theme === 'system' ? <span className="text-muted-foreground"> · {t(`theme.${resolved}`)}</span> : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('home.meta.preview')}</dt>
            <dd className="font-medium">{t(`role.${role}`)}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="ready-title" className="border-t border-divider py-10 md:py-12">
        <div className="flex items-center gap-3 pb-6">
          <h2 id="ready-title" className="text-lg font-semibold tracking-tight">{t('home.statusReady')}</h2>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">{READY.length}</span>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {READY.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="motion-rise flex gap-4 border-t border-divider py-5 first:border-t-0 sm:[&:nth-child(2)]:border-t-0" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{t(title)}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{t(body)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-10 border-t border-divider py-10 md:grid-cols-2 md:py-12">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('home.statusNext')}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t('home.next.body')}</p>
        </div>
        <div className="flex flex-col gap-3 md:border-s md:border-divider md:ps-10">
          <h2 className="text-lg font-semibold tracking-tight">{t('home.statusNot')}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t('home.not.body')}</p>
        </div>
      </section>
    </Page>
  );
}
