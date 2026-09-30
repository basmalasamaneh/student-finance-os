import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page container: consistent max width and gutters on the 4px rhythm. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full min-w-0 max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5 sm:px-8 md:pb-16 md:pt-10 lg:px-14 lg:pt-14', className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="stagger flex flex-col gap-2 pb-7 md:gap-3 md:pb-12">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="type-display max-w-3xl text-foreground" data-testid="text-page-title">
        {title}
      </h1>
      {lede ? <p className="type-body max-w-2xl text-muted-foreground">{lede}</p> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-3">{actions}</div> : null}
    </header>
  );
}

/** Open section separated by a divider — the default hierarchy tool instead of cards. */
export function Section({ id, title, description, children, aside }: { id?: string; title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24 border-t border-divider py-7 md:py-12">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12">
        <div className="flex flex-col gap-2">
          <h2 id={id ? `${id}-title` : undefined} className="type-title">
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

/** Heading row for an open (card-less) region: title, optional meta, and a trailing slot. */
export function SectionHeading({ id, title, meta, trailing, as: As = 'h2' }: { id?: string; title: string; meta?: ReactNode; trailing?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <As id={id} className={As === 'h2' ? 'type-h2' : 'type-title'}>
          {title}
        </As>
        {meta ? <span className="type-label font-normal text-muted-foreground">{meta}</span> : null}
      </div>
      {trailing}
    </div>
  );
}

export function SpecimenTag({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground', className)} data-testid="tag-specimen">
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}
