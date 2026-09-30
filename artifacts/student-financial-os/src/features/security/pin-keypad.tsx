import { useId, useRef } from 'react';
import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTx } from '@/features/money/money-model';
import { normalizePin, validPin } from './security-state';

/** Native keyboard and a large touch keypad are equal alternatives. No PIN enters storage. */
export function PinKeypad({ value, onChange, onSubmit, label, submitLabel, disabled = false }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void;
  label: string; submitLabel: string; disabled?: boolean;
}) {
  const t = useTx();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return <div className="space-y-3">
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    <Input ref={input} id={id} data-testid="input-device-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} dir="ltr"
      aria-describedby={`${id}-help`} value={value} disabled={disabled}
      className="text-center text-2xl tracking-[0.5em]"
      onChange={(e) => onChange(normalizePin(e.target.value).replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => { if (e.key === 'Enter' && validPin(value) && !disabled) { e.preventDefault(); onSubmit(); } }} />
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{t('Use 4–6 digits. This PIN stays on this device only.', 'استخدم ٤–٦ أرقام. هذا الرمز خاص بهذا الجهاز فقط.')}</p>
    <div className="grid grid-cols-3 gap-2" dir="ltr" role="group" aria-label={t('PIN keypad', 'لوحة أرقام الرمز')}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) =>
        <Button key={digit} type="button" variant="outline" className="security-key text-xl" data-testid={`button-pin-${digit}`} disabled={disabled || value.length >= 6} onClick={() => onChange(value + digit)}>{digit}</Button>)}
      <Button type="button" variant="ghost" data-testid="button-pin-clear" disabled={disabled || !value} onClick={() => { onChange(''); input.current?.focus(); }}>{t('Clear', 'مسح')}</Button>
      <Button type="button" variant="outline" className="security-key text-xl" data-testid="button-pin-0" disabled={disabled || value.length >= 6} onClick={() => onChange(value + '0')}>0</Button>
      <Button type="button" variant="ghost" data-testid="button-pin-delete" disabled={disabled || !value} aria-label={t('Delete last digit', 'حذف الرقم الأخير')} onClick={() => onChange(value.slice(0, -1))}><Delete className="size-5" aria-hidden /></Button>
    </div>
    <Button type="button" className="sticky bottom-0 z-10 w-full" data-testid="button-pin-submit" disabled={disabled || !validPin(value)} onClick={onSubmit}>{submitLabel}</Button>
  </div>;
}