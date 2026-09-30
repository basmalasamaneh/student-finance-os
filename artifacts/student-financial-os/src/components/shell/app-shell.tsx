import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useAccount, AccountMenu } from '@/features/auth/account';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { useTheme, type ThemePreference } from '@/features/theme/theme-provider';
import { Menu } from 'lucide-react';
import { GROUP_LABEL, groupedForRole, isActive, itemsForRole, mobileItemsForRole, type NavItem } from '@/features/navigation/nav-config';
import type { TranslationKey } from '@/features/i18n/dictionary';
import { LanguageToggle, ThemeMenu } from './shell-controls';
import { cn } from '@/lib/utils';

function useLabel() {
  const { t } = useI18n();
  const { data } = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 30_000 } });
  const mode = data?.education?.studentType;
  return (item: NavItem) => t((mode === 'school' && item.schoolLabelKey ? item.schoolLabelKey : item.labelKey) as TranslationKey);
}

function BrandMark({ className }: { className?: string }) {
  // Navy tile with a gold ledger arc — the signature detail, not a gold block.
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M10 21.5h12" strokeWidth="2" strokeLinecap="round" className="stroke-background" opacity="0.55" />
      <path d="M10 17.5c2.2-4.6 4.8-7 12-7.5" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-primary" />
      <circle cx="22" cy="10" r="1.9" className="fill-primary" />
    </svg>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex min-h-11 items-center gap-3 rounded-lg" data-testid="link-brand" aria-label={t('app.name')}>
      <BrandMark />
      {collapsed ? null : (
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{t('app.name')}</span>
          <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
        </span>
      )}
    </Link>
  );
}

function PendingDot({ item }: { item: NavItem }) {
  if (item.implemented) return null;
  return <span aria-hidden className="ms-auto size-1 rounded-full bg-muted-foreground/40" />;
}

/** Desktop (≥1024px): light sidebar — brand, grouped nav with gold selection bar, preview profile + controls. */
function Sidebar() {
  const { t } = useI18n();
  const { role } = useAccount();
  const [location] = useLocation();
  const label = useLabel();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[264px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
      <div className="px-5 pb-5 pt-6">
        <Brand />
      </div>
      <nav aria-label={t('a11y.mainNav')} className="flex-1 overflow-y-auto border-t border-sidebar-border px-3 pb-6 pt-4">
        {groupedForRole(role).map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{t(GROUP_LABEL[group])}</p>
            <ul className="flex flex-col">
              {items.map((item) => {
                const active = isActive(item, location);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.path}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150',
                        active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-foreground/75 hover:bg-primary-soft/50 hover:text-foreground',
                      )}
                      data-testid={`link-nav-${item.id}`}
                    >
                      <span aria-hidden className={cn('absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-primary transition-transform duration-150', active ? 'scale-y-100' : 'scale-y-0')} />
                      <Icon className={cn('size-[18px] shrink-0', active ? 'text-gold-ink' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={1.75} aria-hidden />
                      <span className="truncate">{label(item)}</span>
                      <PendingDot item={item} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
        <AccountMenu />
        <div className="flex items-center justify-between gap-1 px-1">
          <span className="text-xs text-muted-foreground">{t('shell.build')}</span>
          <div className="flex items-center">
            <LanguageToggle iconOnly />
            <ThemeMenu />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Tablet (768–1023px): icon rail with tooltips — its own layout, not a squeezed sidebar. */
function Rail() {
  const { t, dir } = useI18n();
  const { role } = useAccount();
  const [location] = useLocation();
  const label = useLabel();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[76px] shrink-0 flex-col items-center border-e border-sidebar-border bg-sidebar py-4 md:flex lg:hidden">
      <Brand collapsed />
      <nav aria-label={t('a11y.mainNav')} className="mt-4 flex flex-1 flex-col items-center gap-1 overflow-y-auto border-t border-sidebar-border pt-4">
        {itemsForRole(role).map((item) => {
          const active = isActive(item, location);
          const Icon = item.icon;
          return (
            <Tooltip key={item.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <Link
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label(item)}
                  className={cn('relative grid size-11 place-items-center rounded-[10px] transition-colors duration-150', active ? 'bg-sidebar-accent text-gold-ink' : 'text-muted-foreground hover:bg-primary-soft/50 hover:text-foreground')}
                  data-testid={`link-rail-${item.id}`}
                >
                  {active ? <span aria-hidden className="absolute inset-y-3 -start-[16px] w-[3px] rounded-full bg-primary" /> : null}
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>{label(item)}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}

/** Resolves the current destination title for the mobile header. */
function usePageTitle() {
  const { t } = useI18n();
  const { role } = useAccount();
  const [location] = useLocation();
  const label = useLabel();
  const match = itemsForRole(role).find((i) => isActive(i, location));
  return match ? label(match) : t('app.name');
}

/**
 * Top bar (<1024px). Mobile: native pattern — mark · page title · More. Preferences live in the
 * More sheet so the bar tells you where you are. Tablet keeps the compact controls inline.
 */
function TopBar() {
  const title = usePageTitle();
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-background/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center gap-2 ps-3 pe-1.5 sm:px-6 md:h-16">
        <div className="md:hidden">
          <Brand collapsed />
        </div>
        <p className="type-subtitle min-w-0 flex-1 truncate md:hidden" aria-live="polite" data-testid="text-header-title">
          {title}
        </p>
        <div className="ms-auto hidden items-center gap-1 md:flex">
          <AccountMenu compact />
          <LanguageToggle />
          <ThemeMenu />
        </div>
        <MoreSheet />
      </div>
    </header>
  );
}

function Segmented({ label, value, options, onChange, testId }: { label: string; value: string; options: { value: string; label: string; lang?: string }[]; onChange: (v: string) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={label}>
      <span className="type-label text-muted-foreground">{label}</span>
      <div className="grid gap-1 rounded-[10px] bg-surface-sunken p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              lang={o.lang}
              onClick={() => onChange(o.value)}
              className={cn('type-label min-h-11 truncate rounded-lg px-2 transition-colors duration-150', on ? 'bg-surface font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              data-testid={`${testId}-${o.value}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile "More": secondary destinations, verified account and preferences. */
function MoreSheet() {
  const { t, lang, setLang } = useI18n();
  const { role } = useAccount();
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();
  const label = useLabel();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', escape);
      trigger.current?.focus();
    };
  }, [open]);

  return (
    <>
      <Button ref={trigger} type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground md:hidden" aria-label={t('a11y.openMenu')} aria-controls="sfos-mobile-more" aria-expanded={open} onClick={() => setOpen(value => !value)} data-testid="button-header-more">
        <Menu aria-hidden />
      </Button>
      {open && createPortal(<>
        <div className="fixed inset-0 z-[70] bg-black/60 md:hidden" aria-hidden onClick={() => setOpen(false)} />
        <div id="sfos-mobile-more" role="dialog" aria-modal="true" aria-labelledby="sfos-mobile-more-title" onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select'));
          const first = focusable[0], last = focusable.at(-1);
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }} className="fixed inset-x-0 bottom-0 z-[71] max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-divider bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 shadow-xl md:hidden">
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-input" />
        <div className="text-start">
          <h2 id="sfos-mobile-more-title" className="type-title">{t('nav.more')}</h2>
          <p className="type-caption">{t('a11y.moreNav')}</p>
        </div>
        <nav aria-label={t('a11y.moreNav')} className="mt-2">
          {groupedForRole(role).map(([group, items]) => (
            <div key={group} className="border-t border-divider py-2 first:border-t-0">
              <p className="type-caption pb-0.5 pt-1 text-muted-foreground">{t(GROUP_LABEL[group])}</p>
              <ul>
                {items.map((item) => {
                  const active = isActive(item, location);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.path}
                        aria-current={active ? 'page' : undefined}
                        className={cn('type-body flex min-h-12 items-center gap-3 rounded-lg px-2', active ? 'bg-primary-soft font-semibold text-foreground' : 'text-foreground')}
                        data-testid={`link-more-${item.id}`}
                      >
                        <Icon className={cn('size-5', active ? 'text-gold-ink' : 'text-muted-foreground')} strokeWidth={1.75} aria-hidden />
                        {label(item)}
                        <PendingDot item={item} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <section aria-label={t('shell.preferences')} className="mt-2 flex flex-col gap-4 border-t border-divider pt-4">
          <h2 className="type-subtitle">{t('shell.preferences')}</h2>
          <Segmented
            label={t('lang.label')}
            value={lang}
            onChange={(v) => setLang(v as 'en' | 'ar')}
            options={[{ value: 'en', label: 'English', lang: 'en' }, { value: 'ar', label: 'العربية', lang: 'ar' }]}
            testId="option-sheet-lang"
          />
          <Segmented
            label={t('theme.label')}
            value={theme}
            onChange={(v) => setTheme(v as ThemePreference)}
            options={(['light', 'dark', 'system'] as const).map((o) => ({ value: o, label: t(`theme.${o}`) }))}
            testId="option-sheet-theme"
          />
          <AccountMenu />
        </section>
        <div className="mt-4">
          <Button ref={closeButton} type="button" variant="secondary" size="lg" className="w-full" onClick={() => setOpen(false)} data-testid="button-close-more">
            {t('a11y.close')}
          </Button>
        </div>
        </div>
      </>, document.body)}
    </>
  );
}

/** Mobile (<768px): five primary destinations. Active = gold pill behind icon + bold label + aria-current. */
function BottomNav() {
  const { t } = useI18n();
  const { role } = useAccount();
  const [location] = useLocation();
  const label = useLabel();
  const primary = mobileItemsForRole(role);

  return (
    <nav aria-label={t('a11y.mobileNav')} className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-background/95 backdrop-blur-md md:hidden">
      <ul className="grid px-1" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = isActive(item, location);
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.path}
                aria-current={active ? 'page' : undefined}
                aria-label={label(item)}
                className={cn('type-nav flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-150', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                data-testid={`link-tab-${item.id}`}
              >
                <span aria-hidden className={cn('grid h-8 w-14 max-w-full place-items-center rounded-full transition-colors duration-150', active ? 'bg-primary-soft ring-1 ring-inset ring-primary/40' : '')}>
                  <Icon className={cn('size-5', active ? 'text-gold-ink' : '')} strokeWidth={active ? 2 : 1.75} />
                </span>
                <span aria-hidden className="max-w-full truncate">{item.mobileLabelKey ? t(item.mobileLabelKey) : label(item)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Move focus to main content on route change so keyboard/screen-reader users land on the new page.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location]);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <a
        href="#main"
        className="fixed start-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
        data-testid="link-skip"
      >
        {t('a11y.skipToContent')}
      </a>
      <Sidebar />
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none" key={location}>
          <div className="motion-fade">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
