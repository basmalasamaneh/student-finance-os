import { useState } from 'react';
import { Banknote, Building2, Check, Copy, Plus, Wallet } from 'lucide-react';
import type { FinanceAccount } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { accountName, ACCOUNT_TYPE_LABEL, label, shortId, type Tx } from '@/features/money/money-model';

const ICONS = { wallet: Wallet, bank: Building2, cash: Banknote, other: Plus } as const;

function CopyId({ id, t }: { id: string; t: Tx }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}
      className="type-caption inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={t(`Copy account ID ${id}`, `نسخ معرّف الحساب ${id}`)} data-testid={`button-copy-id-${id}`}>
      <bdi className="tabular">{shortId(id)}</bdi>{copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span className="sr-only" aria-live="polite">{copied ? t('Copied', 'تم النسخ') : ''}</span>
    </button>
  );
}

export function AccountList({ accounts, selectedId, onSelect, t }: { accounts: FinanceAccount[]; selectedId?: string; onSelect: (id: string) => void; t: Tx }) {
  return (
    <ul className="divide-y divide-divider border-y border-divider" data-testid="list-accounts">
      {accounts.map((a) => {
        const Icon = ICONS[a.type as keyof typeof ICONS] ?? Plus;
        const active = a.id === selectedId;
        return (
          <li key={a.id} className="relative flex min-w-0 items-center gap-3 py-3" data-testid={`row-account-${a.id}`}>
            {active ? <span aria-hidden className="absolute inset-y-2 -start-3 w-0.5 rounded-full bg-primary" /> : null}
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-gold-ink"><Icon className="size-[18px]" aria-hidden /></span>
            <button type="button" onClick={() => onSelect(a.id)} aria-pressed={active} className="flex min-w-0 flex-1 flex-col items-start text-start" data-testid={`button-select-account-${a.id}`}>
              <span className="type-subtitle max-w-full truncate">{accountName(a, t)}</span>
              <span className="type-caption text-muted-foreground">{label(ACCOUNT_TYPE_LABEL, a.type, t)} · {a.currency}</span>
            </button>
            <div className="flex flex-col items-end gap-0.5">
              <MoneyDisplay value={a.balance} size="md" testId={`text-balance-${a.id}`} />
              <CopyId id={a.id} t={t} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
