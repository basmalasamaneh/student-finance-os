import type { ReactNode } from 'react';
import type { FinanceAccount } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { accountName, type Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';

export const inputClass = 'block min-h-[52px] w-full min-w-0 rounded-[14px] border border-input bg-surface px-3.5 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-[invalid=true]:border-destructive md:min-h-11 md:text-[0.9375rem]';

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="type-label">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} role="alert" className="type-caption flex items-center gap-1.5 text-destructive motion-fade" data-testid={`error-${id}`}>{error}</p>
        : hint ? <p id={`${id}-hint`} className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AccountSelect({ id, value, onChange, accounts, t, error, placeholder, testId }: {
  id: string; value: string; onChange: (v: string) => void; accounts: FinanceAccount[]; t: Tx; error?: string; placeholder?: string; testId?: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, 'appearance-auto')}
      aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} data-testid={testId ?? `select-${id}`}>
      <option value="">{placeholder ?? t('Choose an account', 'اختر حساباً')}</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a, t)} · {a.currency}</option>)}
    </select>
  );
}

export function AmountInput({ id, value, onChange, currency, error, large }: { id: string; value: string; onChange: (v: string) => void; currency?: string; error?: string; /** Optional: large centred amount-entry style. */ large?: boolean }) {
  return (
    <div className="relative">
      <input id={id} inputMode="decimal" autoComplete="off" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
        className={cn(inputClass, 'tabular pe-14 text-start', large && 'input-amount min-h-16 ps-14 md:min-h-16')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} data-testid={`input-${id}`} />
      {currency ? <span className="type-caption pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-muted-foreground">{currency}</span> : null}
    </div>
  );
}

/** Label/value row used in review and receipt screens. */
export function ReviewRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:items-baseline sm:gap-4">
      <dt className="type-label min-w-0 break-words font-normal text-muted-foreground">{label}</dt>
      <dd className="type-label min-w-0 max-w-full break-words text-start sm:text-end" data-testid={testId}>{children}</dd>
    </div>
  );
}

export function BalanceHint({ account, t }: { account?: FinanceAccount; t: Tx }) {
  if (!account) return null;
  return (
    <p className="type-caption text-muted-foreground" data-testid="text-available-balance">
      {t('Available', 'المتاح')}: <MoneyDisplay value={account.balance} size="sm" className="!text-xs" />
    </p>
  );
}

export function SimulatedNote({ t, className }: { t: Tx; className?: string }) {
  return (
    <p className={cn('type-caption flex items-start gap-2 rounded-lg bg-primary-soft px-3 py-2 text-foreground', className)} data-testid="text-simulated-disclaimer">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      {t('Simulated. No real money moves. This records a prototype ledger entry only.', 'محاكاة. لا تتحرك أموال حقيقية. يُسجَّل قيد تجريبي فقط.')}
    </p>
  );
}
