import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/features/i18n/i18n-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import { Menu } from 'lucide-react';
import { GROUP_LABEL, groupedForRole, isActive, itemsForRole, mobileItemsForRole, type NavItem } from '@/features/navigation/nav-config';
import type { TranslationKey } from '@/features/i18n/dictionary';
import { LanguageToggle, RolePreviewMenu, ThemeMenu } from './shell-controls';
import { cn } from '@/lib/utils';

function useLabel() {
  const { t } = useI18n();
  const { mode } = usePreview();
  return (item: NavItem) => t((mode === 'school' && item.schoolLabelKey ? item.schoolLabelKey : item.labelKey) as TranslationKey);
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M9 19.5c0 2.2 2.6 3.5 7 3.5s7-1.3 7-3.5-2.6-3-7-3.5-7-1.3-7-3.5S11.6 9 16 9s7 1.3 7 3.5" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-primary-foreground" />
      <circle cx="23" cy="20" r="2.2" className="fill-[hsl(var(--mint-raw))]" />
    </svg>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-3 rounded-lg" data-testid="link-brand" aria-label={t('app.name')}>
      <BrandMark />
      {collapsed ? null : (
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">{t('app.name')}</span>
          <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
        </span>
      )}
    </Link>
  );
}

function PendingDot({ item }: { item: NavItem }) {
  if (item.implemented) return null;
  return <span aria-hidden className="ms-auto size-1.5 rounded-full bg-input" />;
}

/** Desktop (≥1024px): full sidebar grouped by domain. */
function Sidebar() {
  const { t } = useI18n();
  const { role } = usePreview();
  const [location] = useLocation();
  const label = useLabel();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[268px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Brand />
      </div>
      <nav aria-label={t('a11y.mainNav')} className="flex-1 overflow-y-auto px-3 pb-6">
        {groupedForRole(role).map(([group, items]) => (
          <div key={group} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">{t(GROUP_LABEL[group])}</p>
            <ul className="flex flex-col gap-0.5">
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
                        active ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                      )}
                      data-testid={`link-nav-${item.id}`}
                    >
                      {active ? <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-primary" /> : null}
                      <Icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} aria-hidden />
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
    </aside>
  );
}

/** Tablet (768–1023px): icon rail with tooltips — its own layout, not a squeezed sidebar. */
function Rail() {
  const { t, dir } = useI18n();
  const { role } = usePreview();
  const [location] = useLocation();
  const label = useLabel();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[76px] shrink-0 flex-col items-center border-e border-sidebar-border bg-sidebar py-5 md:flex lg:hidden">
      <Brand collapsed />
      <nav aria-label={t('a11y.mainNav')} className="mt-6 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
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
                  className={cn('grid size-11 place-items-center rounded-xl transition-colors', active ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                  data-testid={`link-rail-${item.id}`}
                >
                  <Icon className="size-5" aria-hidden />
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

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-10">
        <div className="md:hidden">
          <Brand collapsed />
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <div className="hidden sm:block">
            <RolePreviewMenu />
          </div>
          <div className="sm:hidden">
            <RolePreviewMenu compact />
          </div>
          <LanguageToggle />
          <ThemeMenu />
          <MoreSheet />
        </div>
      </div>
    </header>
  );
}

/** Mobile secondary navigation: header button opening a bottom sheet with every destination. */
function MoreSheet() {
  const { t } = useI18n();
  const { role } = usePreview();
  const [location] = useLocation();
  const label = useLabel();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground md:hidden" aria-label={t('a11y.openMenu')} data-testid="button-header-more">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6">
        <SheetHeader className="text-start">
          <SheetTitle>{t('nav.more')}</SheetTitle>
          <SheetDescription>{t('a11y.moreNav')}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t('a11y.moreNav')} className="mt-4">
          {groupedForRole(role).map(([group, items]) => (
            <div key={group} className="border-t border-divider py-3 first:border-t-0">
              <p className="pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t(GROUP_LABEL[group])}</p>
              <ul>
                {items.map((item) => {
                  const active = isActive(item, location);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.path}
                        aria-current={active ? 'page' : undefined}
                        className={cn('flex min-h-12 items-center gap-3 rounded-lg px-2 text-[15px]', active ? 'font-semibold text-primary' : 'text-foreground')}
                        data-testid={`link-more-${item.id}`}
                      >
                        <Icon className="size-5 text-muted-foreground" aria-hidden />
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
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)} data-testid="button-close-more">
            {t('a11y.close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Mobile (<768px): up to five primary destinations. Secondary destinations live in the header sheet. */
function BottomNav() {
  const { t } = useI18n();
  const { role } = usePreview();
  const [location] = useLocation();
  const label = useLabel();
  const primary = mobileItemsForRole(role);

  return (
    <nav aria-label={t('a11y.mobileNav')} className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = isActive(item, location);
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.path}
                aria-current={active ? 'page' : undefined}
                aria-label={label(item)}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground')}
                data-testid={`link-tab-${item.id}`}
              >
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary-soft')}>
                  <Icon className="size-5" aria-hidden />
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
        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none" key={location}>
          <div className="motion-fade">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
