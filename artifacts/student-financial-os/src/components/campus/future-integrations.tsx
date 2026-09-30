import { Building, CreditCard, QrCode, Smartphone } from 'lucide-react';
import type { Tx } from '@/features/money/money-model';

const ITEMS = [
  { id: 'university', icon: Building, en: 'Real University Payment', ar: 'الدفع الجامعي الحقيقي' },
  { id: 'wallet', icon: Smartphone, en: 'Digital Wallet', ar: 'المحفظة الرقمية' },
  { id: 'qr', icon: QrCode, en: 'QR Payment', ar: 'الدفع عبر QR' },
  { id: 'bank', icon: CreditCard, en: 'Bank Payment', ar: 'الدفع البنكي' },
] as const;

/** Future rails are displayed as disabled. Nothing here is wired or pretends to work. */
export function FutureIntegrations({ t }: { t: Tx }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="list-future-integrations">
      {ITEMS.map(({ id, icon: Icon, en, ar }) => (
        <li key={id} aria-disabled="true" className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-input px-3 py-3 text-muted-foreground" data-testid={`item-integration-${id}`}>
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="type-label min-w-0 flex-1 text-foreground/70">{t(en, ar)}</span>
          <span className="type-caption shrink-0 rounded-full bg-muted px-2 py-0.5">{t('Coming soon', 'قريباً')}</span>
        </li>
      ))}
    </ul>
  );
}
