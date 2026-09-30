// Run: node --experimental-strip-types --test src/features/transactions/history-filters.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, buildParams, parseBound, isValidDay, filtersFromSearch, filtersToSearch, activeFilterCount, pageCount } from './history-filters.ts';

test('parseBound uses exact minor units', () => {
  assert.deepEqual(parseBound('12.5', 'ILS'), { ok: true, minor: 1250 });
  assert.deepEqual(parseBound('0.1', 'USD'), { ok: true, minor: 10 });
  assert.deepEqual(parseBound('1.005', 'JOD'), { ok: true, minor: 1005 });
  assert.deepEqual(parseBound('0', 'ILS'), { ok: true, minor: 0 });
  assert.deepEqual(parseBound('', 'ILS'), { ok: true, minor: undefined });
  assert.deepEqual(parseBound('١٢٫٥', 'ILS'), { ok: true, minor: 1250 });
  assert.deepEqual(parseBound('1.005', 'ILS'), { ok: false, reason: 'precision' });
  assert.deepEqual(parseBound('-1', 'ILS'), { ok: false, reason: 'format' });
  assert.deepEqual(parseBound('1e3', 'ILS'), { ok: false, reason: 'format' });
  assert.deepEqual(parseBound('90071992547409.92', 'ILS'), { ok: false, reason: 'range' });
});

test('dates validated as real calendar days', () => {
  assert.equal(isValidDay('2024-02-29'), true);
  assert.equal(isValidDay('2023-02-29'), false);
  assert.equal(isValidDay('2024-13-01'), false);
});

test('buildParams combines filters and flags errors', () => {
  const ok = buildParams({ ...EMPTY_FILTERS, search: '  cafe ', amountMin: '5', amountCurrency: 'JOD', dateFrom: '2024-01-01', dateTo: '2024-01-01', page: 3 });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.params, { search: 'cafe', dateFrom: '2024-01-01', dateTo: '2024-01-01', amountMin: 5000, amountCurrency: 'JOD', page: 3, limit: 20 });
  const bad = buildParams({ ...EMPTY_FILTERS, amountMin: '10', amountMax: '2', dateFrom: '2024-02-02', dateTo: '2024-02-01', goalId: 'nope' });
  assert.deepEqual(bad.errors.sort(), ['amountOrder', 'dateOrder', 'goalId']);
  assert.equal(buildParams(EMPTY_FILTERS).params.amountCurrency, undefined);
});

test('URL round trip', () => {
  const f = { ...EMPTY_FILTERS, type: 'expense', amountMax: '3', amountCurrency: 'USD' as const, page: 2 };
  const s = filtersToSearch(f);
  assert.deepEqual(filtersFromSearch(s), f);
  assert.equal(filtersFromSearch('page=-4').page, 1);
  assert.equal(activeFilterCount(f), 2);
  assert.equal(pageCount(0, 20), 1);
  assert.equal(pageCount(41, 20), 3);
});
