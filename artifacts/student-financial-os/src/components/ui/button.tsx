import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

/*
 * Canonical button. Gold is reserved for the single primary action per view.
 * Restrained 14px radius (not pills). Controls animate 150ms; pressed = darker gold + 1px settle.
 */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/85',
        outline: 'border border-input bg-transparent text-foreground hover:border-gold-ink/45 hover:bg-primary-soft/50',
        secondary: 'border border-border bg-surface text-foreground hover:border-input hover:bg-surface-sunken',
        ghost: 'text-foreground hover:bg-primary-soft/60 active:bg-primary-soft',
        link: 'text-gold-ink underline decoration-gold-ink/35 underline-offset-4 hover:decoration-gold-ink',
      },
      size: {
        default: 'min-h-11 px-4',
        sm: 'min-h-11 px-3 text-[13px] md:min-h-9',
        lg: 'min-h-12 px-6 text-[15px]',
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
