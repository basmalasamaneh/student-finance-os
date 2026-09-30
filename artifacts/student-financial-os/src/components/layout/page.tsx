import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page container: consistent max width and gutters on the 4px rhythm. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-5 pb-28 pt-8 sm:px-8 md:pb-16 md:pt-12 lg:px-12', className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="stagger flex flex-col gap-4 pb-10 md:pb-12">
      {eyebrow ? <p className="text-[13px] font-medium tracking-wide text-primary">{eyebrow}</p> : null}
      <h1 className="max-w-3xl text-[32px] font-semibold leading-[1.15] tracking-tight text-foreground md:text-[40px]" data-testid="text-page-title">
        {title}
      </h1>
      {lede ? <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-[17px]">{lede}</p> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
    </header>
  );
}

/** Open section separated by a divider — the default hierarchy tool instead of cards. */
export function Section({ id, title, description, children, aside }: { id?: string; title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24 border-t border-divider py-10 md:py-12">
      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
        <div className="flex flex-col gap-2">
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          {aside}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function SpecimenTag({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-dashed border-input px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--amber-raw))]" />
      {label}
    </span>
  );
}
