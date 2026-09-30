/*
 * HOME SPECIMEN FIXTURE — the single source of static example content for the
 * design-reference home. Not user data, not balances, never fetched, never
 * reused by features. All copy is referenced by translation key (EN + AR).
 */
import { money, type Money } from '@/lib/money';
import type { TranslationKey } from '@/features/i18n/dictionary';
import type { StatusTone } from '@/components/finance/status-badge';
import type { RowDirection } from '@/components/finance/transaction-row';

const d = (m: number, day: number) => new Date(Date.UTC(2025, m - 1, day, 9, 0));

export interface SpecimenUpcoming { id: string; title: TranslationKey; meta: TranslationKey; due: Date; amount: Money; tone: StatusTone; status: TranslationKey }
export interface SpecimenGoal { id: string; name: TranslationKey; saved: Money; target: Money; ratio: number }
export interface SpecimenActivity { id: string; title: TranslationKey; meta: TranslationKey; amount: Money; date: Date; direction: RowDirection }

export const HOME_SPECIMEN = {
  balance: money(284650),
  nextAllowance: d(4, 1),
  projectedRemaining: money(41530),
  period: {
    spent: money(-131240),
    planned: money(210000),
    left: money(78760),
    projected: money(196470),
    used: 0.625,
  },
  upcoming: [
    { id: 'rent', title: 'hs.up.rent', meta: 'hs.up.rentMeta', due: d(3, 28), amount: money(-95000), tone: 'warning', status: 'hs.status.soon' },
    { id: 'phone', title: 'hs.up.phone', meta: 'hs.up.phoneMeta', due: d(3, 30), amount: money(-4990), tone: 'info', status: 'hs.status.scheduled' },
    { id: 'books', title: 'hs.up.books', meta: 'hs.up.booksMeta', due: d(4, 3), amount: money(-18750), tone: 'neutral', status: 'hs.status.planned' },
  ] satisfies SpecimenUpcoming[],
  savings: [
    { id: 'laptop', name: 'hs.sv.laptop', saved: money(186000), target: money(420000), ratio: 186000 / 420000 },
    { id: 'summer', name: 'hs.sv.summer', saved: money(72500), target: money(90000), ratio: 72500 / 90000 },
  ] satisfies SpecimenGoal[],
  activity: [
    { id: 'cafe', title: 'hs.ac.cafe', meta: 'hs.ac.cafeMeta', amount: money(-1850), date: d(3, 24), direction: 'out' },
    { id: 'allow', title: 'hs.ac.allow', meta: 'hs.ac.allowMeta', amount: money(150000), date: d(3, 1), direction: 'in' },
    { id: 'print', title: 'hs.ac.print', meta: 'hs.ac.printMeta', amount: money(-640), date: d(3, 22), direction: 'out' },
    { id: 'bus', title: 'hs.ac.bus', meta: 'hs.ac.busMeta', amount: money(-5000), date: d(3, 21), direction: 'pending' },
  ] satisfies SpecimenActivity[],
} as const;
