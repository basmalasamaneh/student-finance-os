import { Banknote, Building2, Plus, Wallet } from 'lucide-react';
import type { FinanceAccount } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { accountName, ACCOUNT_TYPE_LABEL, label, type Tx } from '@/features/money/money-model';
import { SensitiveReference } from '@/features/security/sensitive-reference';
import { useDeviceSecurity } from '@/features/security/device-security';

const ICONS = { wallet: Wallet, bank: Building2, cash: Banknote, other: Plus } as const;

export function AccountList({ accounts, selectedId, onSelect, t }: { accounts: FinanceAccount[]; selectedId?: string; onSelect: (id: string) => void; t: Tx }) {
  const { hideBalances } = useDeviceSecurity();
  return (
    <ul className="flex flex-col gap-2" data-testid="list-accounts">
      {accounts.map((a) => {
        const Icon = ICONS[a.type as keyof typeof ICONS] ?? Plus;
        const active = a.id === selectedId;
        return (
          <li key={a.id} className={`relative flex min-w-0 flex-wrap items-center gap-3 rounded-card border bg-card p-3.5 shadow-xs transition-colors md:p-4 ${active ? 'border-primary ring-1 ring-primary/40' : 'border-card-border'}`} data-testid={`row-account-${a.id}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-gold-ink"><Icon className="size-[18px]" aria-hidden /></span>
            <button type="button" onClick={() => onSelect(a.id)} aria-pressed={active} className="flex min-w-0 flex-1 flex-col items-start text-start" data-testid={`button-select-account-${a.id}`}>
              <span className="type-subtitle max-w-full truncate">{accountName(a, t)}</span>
              <span className="type-caption text-muted-foreground">{label(ACCOUNT_TYPE_LABEL, a.type, t)} · {a.currency}</span>
            </button>
            <div className="flex flex-col items-end gap-0.5">
              <MoneyDisplay value={a.balance} hidden={hideBalances} hiddenLabel={t('Balance hidden', 'الرصيد مخفي')} size="md" testId={`text-balance-${a.id}`} />
            </div>
            <div className="flex min-w-0 basis-full justify-end">
              <SensitiveReference value={a.id} label={t('Account ID', 'معرّف الحساب')} copy className="max-w-full" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
