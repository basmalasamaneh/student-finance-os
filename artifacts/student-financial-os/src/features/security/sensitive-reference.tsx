import { useId, useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';
import './security.css';

export type SensitiveReferenceProps = { value: string; label?: string; copy?: boolean; className?: string };

export function SensitiveReference(props: SensitiveReferenceProps) {
  // A changed reference always starts masked, even when this component instance is reused.
  return <ReferenceValue key={props.value} {...props} />;
}
function ReferenceValue({ value, label, copy = false, className }: SensitiveReferenceProps) {
  const t = useTx();
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState('');
  const id = useId();
  const name = label || t('Reference', 'المرجع');
  const masked = value.length > 4 ? `${'•'.repeat(Math.min(value.length - 4, 16))}${value.slice(-4)}` : '••••';
  const copyValue = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setStatus(t('Copied. Share this reference only with someone you trust.', 'تم النسخ. شارك هذا المرجع مع شخص تثق به فقط.'));
    } catch {
      setStatus(t('Could not copy. Reveal the reference and copy it manually.', 'تعذّر النسخ. أظهر المرجع وانسخه يدوياً.'));
    }
  };
  return <span className={cn('security-reference', className)}>
    <span className="security-reference-text">
      <span className="block text-xs text-muted-foreground">{name}</span>
      <bdi id={id} className="security-reference-value font-mono text-sm" data-testid="text-sensitive-reference" dir="ltr">{revealed ? value : masked}</bdi>
    </span>
    <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-controls={id} aria-pressed={revealed} aria-label={revealed ? t(`Hide ${name}`, `إخفاء ${name}`) : t(`Reveal ${name}`, `إظهار ${name}`)} data-testid="button-reference-reveal" onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}</Button>
    {copy && <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" data-testid="button-reference-copy" aria-label={t(`Copy ${name}`, `نسخ ${name}`)} onClick={() => void copyValue()}><Copy className="size-4" aria-hidden /></Button>}
    <span role="status" className="w-full text-xs text-muted-foreground">{status}</span>
  </span>;
}