import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { StatePanel } from '@/components/states/state-panel';
import type { Tx } from '@/features/money/money-model';

/** Prompt 8: honest placeholder. Full request workflow is Prompt 9. Pass `children` only with permissioned server data. */
export function ParentRequestsComingSoon({ t, children }: { t: Tx; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6" data-testid="section-parent-requests">
      <StatePanel tone="empty" icon={<Inbox className="size-5" />}
        title={t('Requests are coming soon', 'الطلبات قادمة قريباً')}
        body={t('Approving or declining your child’s requests isn’t available yet. Nothing here is pending on your side.', 'الموافقة على طلبات ابنك أو رفضها غير متاحة بعد. لا شيء معلّق من جهتك.')} />
      {children}
    </div>
  );
}
