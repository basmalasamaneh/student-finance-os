import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barPercent, minorToInput } from './planning-math.ts';

test('minorToInput is exact per currency', () => {
  assert.equal(minorToInput(1250, 'ILS'), '12.50');
  assert.equal(minorToInput(5, 'USD'), '0.05');
  assert.equal(minorToInput(1005, 'JOD'), '1.005');
  assert.equal(minorToInput(-300, 'ILS'), '-3.00');
  assert.equal(minorToInput(9007199254740991, 'ILS'), '90071992547409.91');
});

test('barPercent clamps and never uses floats', () => {
  assert.equal(barPercent(0, 1000), 0);
  assert.equal(barPercent(500, 1000), 50);
  assert.equal(barPercent(1500, 1000), 100);
  assert.equal(barPercent(10, 0), 100);
  assert.equal(barPercent(9007199254740991, 9007199254740991), 100);
});
