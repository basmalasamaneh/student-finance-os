import { formatMoney, type Money } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'hero';
/**
 * Semantic tones:
 * - default / negative: foreground (spending never screams red)
 * - positive: calm success green, paired with "+" via showPlus
 * - neutral / muted: secondary text
 * - planned: intended, not yet happened → dotted underline
 * - projected: an estimate → "≈" prefix, secondary text
 * - highlight: gold ink for the one key figure in a view
 */
export type MoneyTone = 'default' | 'muted' | 'neutral' | 'positive' | 'negative' | 'planned' | 'projected' | 'highlight';

const sizes: Record<Size, string> = {
  sm: 'text-sm font-medium',
  md: 'text-base font-semibold',
  lg: 'text-2xl font-semibold tracking-[-0.015em]',
  xl: 'text-[32px] leading-none font-semibold tracking-[-0.02em] md:text-[40px]',
  hero: 'figure-hero',
};
/** Long figures step down one size so hero/xl amounts never clip at 320px (no truncation, no overflow hiding). */
const longSizes: Partial<Record<Size, string>> = {
  hero: 'figure-hero figure-long',
  xl: 'text-[26px] leading-none font-semibold md:text-[34px]',
};
const tones: Record<MoneyTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  neutral: 'text-muted-foreground',
  positive: 'text-success',
  negative: 'text-foreground',
  planned: 'text-foreground underline decoration-muted-foreground/60 decoration-dotted decoration-[1.5px] underline-offset-[5px]',
  projected: 'text-muted-foreground',
  highlight: 'text-gold-ink',
};

/**
 * Reusable amount display. Formatting is delegated to finance-core
 * (integer minor units + explicit currency). `<bdi>` isolates direction
 * so currency symbols never reorder inside Arabic sentences.
 */
export function MoneyDisplay({
  value,
  size = 'md',
  tone = 'default',
  showPlus = false,
  hidden = false,
  hiddenLabel = 'Amount hidden',
  className,
  testId,
}: {
  value: Money;
  size?: Size;
  tone?: MoneyTone;
  /** Prefix positive amounts with "+" (e.g. money in). */
  showPlus?: boolean;
  hidden?: boolean;
  hiddenLabel?: string;
  className?: string;
  testId?: string;
}) {
  const { locale } = useI18n();
  const formatted = formatMoney(value, locale);
  const text = `${formatted}`;
  const sizeClass = text.length > 11 && longSizes[size] ? longSizes[size] : sizes[size];
  const prefix = tone === 'projected' ? '≈ ' : showPlus && value.minor > 0 ? '+' : '';
  if (hidden) {
    return (
      <span className={cn('tabular select-none', sizes[size], 'text-muted-foreground', className)} aria-label={hiddenLabel} data-testid={testId}>
        <span aria-hidden>••••</span>
      </span>
    );
  }
  return (
    <bdi dir="ltr" className={cn('tabular inline-block whitespace-nowrap', sizeClass, tones[tone], className)} data-testid={testId}>
      {prefix}
      {formatted}
    </bdi>
  );
}
