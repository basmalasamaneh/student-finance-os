import { ShieldCheck } from 'lucide-react';
import type { FamilyPermissions } from '@workspace/api-client-react';
import { Switch } from '@/components/ui/switch';
import { PERMISSION_KEYS, PERMISSION_TEXT, type PermissionKey } from '@/features/family/family-view';
import type { Tx } from '@/features/money/money-model';
import { cn } from '@/lib/utils';

/** Eight independent switches, all default off. Campus spending is set apart as an explicit opt-in. */
export function PermissionEditor({ value, onChange, t, disabled, idPrefix = 'perm' }: {
  value: FamilyPermissions; onChange: (next: FamilyPermissions) => void; t: Tx; disabled?: boolean; idPrefix?: string;
}) {
  const set = (k: PermissionKey, v: boolean) => onChange({ ...value, [k]: v });
  const row = (k: PermissionKey, campus = false) => {
    const id = `${idPrefix}-${k}`;
    return (
      <li key={k} className={cn('flex min-h-14 items-center justify-between gap-4 py-3', campus && 'rounded-[14px] border border-dashed border-gold-ink/35 bg-primary-soft px-3')}>
        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
          <span className="type-label">{t(...PERMISSION_TEXT[k].title)}</span>
          <span className="type-caption text-muted-foreground">{t(...PERMISSION_TEXT[k].body)}</span>
        </label>
        <Switch id={id} checked={value[k]} onCheckedChange={(v) => set(k, v)} disabled={disabled} data-testid={`switch-${id}`} />
      </li>
    );
  };
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="type-label mb-1 flex items-center gap-2"><ShieldCheck className="size-4 text-gold-ink" aria-hidden />{t('What they can see', 'ما يمكنه رؤيته')}</legend>
      <p className="type-caption text-muted-foreground">{t('Everything starts off. Turn on only what you want to share — you can change this any time.', 'كل شيء مغلق افتراضياً. فعّل فقط ما تريد مشاركته — يمكنك التغيير متى شئت.')}</p>
      <ul className="divide-y divide-divider">{PERMISSION_KEYS.filter((k) => k !== 'campusSpending').map((k) => row(k))}</ul>
      <ul className="mt-2">{row('campusSpending', true)}</ul>
    </fieldset>
  );
}
