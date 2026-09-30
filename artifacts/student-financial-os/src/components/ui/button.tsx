import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

/*
 * Canonical button (Gold Phase 2).
 * default   — flat gold fill + on-brand ink. Inside a .surface-gold hero it becomes the hero's flat dark primary.
 * gradient  — the ONE emphasised primary per screen (first primary when a screen has no hero). Never on every button.
 * outline / secondary — outlined gold / quiet surface. tertiary — text-only. destructive — error colour.
 * 52px on mobile, 44px desktop; press = scale .97 + pressed colour; disabled is desaturated + dimmed.
 */
const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[15px] font-medium transition-[background-color,border-color,color,transform,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 disabled:saturate-[.35] disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-45 md:text-sm [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-pressed',
        gradient: 'btn-gradient text-on-brand',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/85',
        outline: 'border border-gold-ink/35 bg-transparent text-gold-ink hover:border-gold-ink/60 hover:bg-primary-soft active:bg-accent',
        secondary: 'border border-border bg-surface text-foreground hover:border-input hover:bg-surface-sunken active:bg-muted',
        tertiary: 'text-gold-ink hover:bg-primary-soft/70 active:bg-primary-soft',
        ghost: 'text-foreground hover:bg-primary-soft/60 active:bg-primary-soft',
        link: 'text-gold-ink underline decoration-gold-ink/35 underline-offset-4 hover:decoration-gold-ink active:scale-100',
      },
      size: {
        default: 'min-h-[52px] px-5 md:min-h-11 md:px-4',
        sm: 'min-h-11 px-3 text-[13px] md:min-h-9',
        lg: 'min-h-[52px] px-6 text-base',
        icon: 'size-11 md:size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Optional: shows a spinner, keeps the button width, disables and sets aria-busy. Ignored with asChild. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), loading && 'btn-loading disabled:opacity-80 disabled:saturate-100')}
        ref={ref}
        disabled={disabled || loading}
        {...props}
        aria-busy={loading || props['aria-busy'] || undefined}
      >
        {loading ? <span className="contents">{children}</span> : children}
        {loading ? (
          <span className="btn-spinner" aria-hidden>
            <Loader2 className="animate-spin" />
          </span>
        ) : null}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
