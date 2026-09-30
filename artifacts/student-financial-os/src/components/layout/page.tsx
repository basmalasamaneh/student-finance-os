import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page container: consistent max width and gutters on the 4px rhythm. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-5 pb-28 pt-8 sm:px-8 md:pb-16 md:pt-12 lg:px-14 lg:pt-14', className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="stagger flex flex-col gap-3 pb-10 md:pb-14">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="max-w-3xl text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground md:text-[32px]" data-testid="text-page-title">
        {title}
      </h1>
      {lede ? <p className="max-w-2xl text-base leading-7 text-muted-foreground">{lede}</p> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-3">{actions}</div> : null}
    </header>
  );
}

/** Open section separated by a divider — the default hierarchy tool instead of cards. */
export function Section({ id, title, description, children, aside }: { id?: string; title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24 border-t border-divider py-10 md:py-12">
      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12">
        <div className="flex flex-col gap-2">
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold tracking-[-0.01em] md:text-[19px]">
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
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <As id={id} className={cn('font-semibold tracking-[-0.01em]', As === 'h2' ? 'text-lg md:text-[19px]' : 'text-[15px]')}>
          {title}
        </As>
        {meta ? <span className="text-[13px] text-muted-foreground">{meta}</span> : null}
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
