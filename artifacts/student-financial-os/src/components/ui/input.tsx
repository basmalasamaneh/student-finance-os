import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputBase =
  'flex h-[52px] w-full rounded-[14px] border border-input bg-surface px-3.5 py-1 text-base shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-foreground/30 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 md:h-11 md:text-sm';

export interface InputProps extends React.ComponentProps<'input'> {
  /** Optional: renders a clear button while the input has a value. Handler is the caller's (no internal state). */
  onClear?: () => void;
  /** Accessible label for the clear button. */
  clearLabel?: string;
  /** Optional: large centred numeric amount style. Pair with inputMode="decimal". */
  amount?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClear, clearLabel = 'Clear', amount, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const controlled = props.value !== undefined;
    // Uncontrolled + onClear only: track the DOM value so the clear button hides/shows correctly.
    const [domFilled, setDomFilled] = React.useState(() => String(props.defaultValue ?? '').length > 0);
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    if (!onClear) {
      return (
        <input
          type={type}
          className={cn(inputBase, amount && 'input-amount h-16 md:h-16', className)}
          ref={ref}
          {...props}
        />
      );
    }
    const { onChange } = props;
    const el = (
      <input
        type={type}
        className={cn(inputBase, amount && 'input-amount h-16 md:h-16', 'pe-11', className)}
        ref={setRefs}
        {...props}
        onChange={(e) => {
          if (!controlled) setDomFilled(e.currentTarget.value.length > 0);
          onChange?.(e);
        }}
      />
    );
    const hasValue = controlled ? String(props.value).length > 0 : domFilled;
    const handleClear = () => {
      const node = innerRef.current;
      if (!controlled && node) {
        node.value = '';
        setDomFilled(false);
      }
      onClear();
      node?.focus();
    };
    return (
      <div className="relative w-full min-w-0">
        {el}
        {hasValue && !props.disabled ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={clearLabel}
            className="absolute inset-y-0 end-1 my-auto grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-testid="button-clear-input"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
