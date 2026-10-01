import type { ReactNode } from 'react';
import { Page } from '@/components/layout/page';
import { StatePanel } from '@/components/states/state-panel';
import { useAccount } from '@/features/auth/account';
import { SkeletonRows } from '@/components/states/state-panel';
import { useParentFreshnessGate } from '@/features/family/parent-freshness';
import type { Tx } from '@/features/money/money-model';

/** Parent-only screens never query for other roles (server still authorizes). */
export function ParentOnly({ t, children }: { t: Tx; children: ReactNode }) {
  const me = useAccount();
  if (me.role !== 'parent') return <Page><StatePanel tone="permission" title={t('For parent accounts', 'لحسابات أولياء الأمور')} body={t('This area is only available to parent accounts.', 'هذا القسم متاح لحسابات أولياء الأمور فقط.')} /></Page>;
  return <Gate t={t}>{children}</Gate>;
}

/** Keeps the subtree mounted (queries stay active) but hidden + inert while return-refetch runs. */
function Gate({ t, children }: { t: Tx; children: ReactNode }) {
  const concealed = useParentFreshnessGate();
  return <div className="relative">
    {concealed ? <div className="absolute inset-x-0 top-0 z-10" data-testid="parent-refreshing"><Page><SkeletonRows rows={4} label={t('Checking what’s shared…', 'جارٍ التحقق مما هو مشترك…')} /></Page></div> : null}
    <div data-parent-confidential inert={concealed || undefined} aria-hidden={concealed || undefined}>{children}</div>
  </div>;
}
