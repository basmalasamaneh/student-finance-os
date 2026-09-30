// Run: node --experimental-strip-types --test src/features/home/student-home-model.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  divideHalfUp, monthlyEquivalent, weeklyAllowance, estimateMonthlyIncome, upcomingIncomes,
  nextAllowance, toDay, shareTenths, formatTenths, deriveInsight, type HomeIncome,
} from './student-home-model.ts';

const inc = (id: string, minor: number, frequency: HomeIncome['frequency'], extra: Partial<HomeIncome> = {}): HomeIncome => ({
  id, source: 'part_time', amount: { minor, currency: 'ILS' }, frequency, active: true, ...extra,
});

test('monthly normalisation factors', () => {
  assert.deepEqual(monthlyEquivalent(1200, 'daily'), { ok: true, minor: 36500 });
  assert.deepEqual(monthlyEquivalent(1200, 'weekly'), { ok: true, minor: 5200 });
  assert.deepEqual(monthlyEquivalent(1200, 'biweekly'), { ok: true, minor: 2600 });
  assert.deepEqual(monthlyEquivalent(1200, 'monthly'), { ok: true, minor: 1200 });
  assert.deepEqual(monthlyEquivalent(1200, 'quarterly'), { ok: true, minor: 400 });
  assert.deepEqual(monthlyEquivalent(1200, 'yearly'), { ok: true, minor: 100 });
  assert.equal(monthlyEquivalent(1200, 'one_time'), null);
  assert.equal(monthlyEquivalent(1200, 'irregular'), null);
});

test('half-up rounding and overflow', () => {
  assert.deepEqual(divideHalfUp(5n, 2n), { ok: true, minor: 3 });
  assert.deepEqual(divideHalfUp(4n, 3n), { ok: true, minor: 1 });
  assert.deepEqual(monthlyEquivalent(Number.MAX_SAFE_INTEGER, 'daily'), { ok: false, reason: 'overflow' });
});

test('sums per currency exactly, never mixing, excluding unscheduled', () => {
  const r = estimateMonthlyIncome([
    inc('a', 1, 'weekly'), inc('b', 1, 'weekly'), inc('c', 1, 'weekly'),
    inc('d', 500, 'monthly', { amount: { minor: 500, currency: 'USD' } }),
    inc('e', 999, 'one_time'), inc('f', 999, 'irregular'), inc('g', 999, 'monthly', { active: false }),
  ]);
  // 3 x 1 x 52 / 12 = 13 exactly (not 3 x round(4.33))
  assert.deepEqual(r.byCurrency, [
    { currency: 'ILS', result: { ok: true, minor: 13 }, sourceCount: 3 },
    { currency: 'USD', result: { ok: true, minor: 500 }, sourceCount: 1 },
  ]);
  assert.equal(r.excluded, 2);
  assert.equal(r.activeCount, 6);
});

test('weekly allowance annualisation', () => {
  const a = { minor: 5200, currency: 'JOD' as const };
  assert.deepEqual(weeklyAllowance(a, 'weekly'), { currency: 'JOD', result: { ok: true, minor: 5200 } });
  assert.deepEqual(weeklyAllowance(a, 'yearly'), { currency: 'JOD', result: { ok: true, minor: 100 } });
  assert.deepEqual(weeklyAllowance(a, 'quarterly'), { currency: 'JOD', result: { ok: true, minor: 400 } });
  assert.deepEqual(weeklyAllowance(a, 'monthly'), { currency: 'JOD', result: { ok: true, minor: 1200 } });
  assert.deepEqual(weeklyAllowance({ minor: 100, currency: 'ILS' }, 'daily'), { currency: 'ILS', result: { ok: true, minor: 702 } });
  assert.equal(weeklyAllowance(a, 'irregular'), null);
  assert.equal(weeklyAllowance(undefined, 'weekly'), null);
});

test('upcoming and next allowance use stored dates only', () => {
  const list = [
    inc('p1', 100, 'monthly', { source: 'parent_allowance', expectedDate: '2025-03-10' }),
    inc('p2', 100, 'monthly', { source: 'parent_allowance', expectedDate: '2025-02-01' }),
    inc('p3', 100, 'monthly', { source: 'parent_allowance', expectedDate: '2025-02-05', active: false }),
    inc('p4', 100, 'monthly', { source: 'parent_allowance' }),
    inc('s', 100, 'one_time', { expectedDate: '2025-02-02' }),
  ];
  assert.equal(nextAllowance(list, '2025-02-03')?.income.id, 'p1');
  assert.equal(nextAllowance(list, '2025-03-11'), null);
  assert.deepEqual(upcomingIncomes(list, '2025-02-01').map((u) => u.income.id), ['p2', 's', 'p1']);
  assert.equal(toDay('2025-02-30'), null);
  assert.equal(toDay('2025-02-03T10:00:00Z'), '2025-02-03');
});

test('insight is deterministic', () => {
  assert.deepEqual(deriveInsight({ incomes: [] }), { kind: 'no-income' });
  assert.deepEqual(deriveInsight({ incomes: [inc('x', 1, 'irregular')] }), { kind: 'only-unscheduled', count: 1 });
  assert.deepEqual(
    deriveInsight({ incomes: [inc('x', 300000, 'monthly')], commuteMonthly: { minor: 45000, currency: 'ILS' } }),
    { kind: 'cost-share', cost: 'commute', tenths: 150, currency: 'ILS' },
  );
  assert.deepEqual(
    deriveInsight({ incomes: [inc('x', 300000, 'monthly')], housingShare: { minor: 100, currency: 'USD' } }),
    { kind: 'currency-mismatch', cost: 'housing' },
  );
  assert.equal(shareTenths(1, 3), 333);
  assert.equal(shareTenths(1, 0), null);
  assert.equal(formatTenths(153), '15.3');
});
