import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTEMPT_LIMIT, COOLDOWN_MS, decodeSecurityState, defaultSecurityState, hashPin,
  isUserIdleActivity, legacyHideBalances, normalizePin, parseThreshold, remainingCooldown, reserveAttempt, securityKey,
  thresholdText, validPin, verifyPin,
} from './security-state.ts';

test('opt-in defaults and exact ILS threshold', () => {
  const state = defaultSecurityState();
  assert.equal(state.pin, null);
  assert.equal(state.hideBalances, false);
  assert.equal(state.thresholdMinor, 20_000);
  assert.deepEqual(decodeSecurityState(null), state);
  assert.equal(parseThreshold('200'), 20_000);
  assert.equal(parseThreshold('٠٫٢٩'), 29);
  assert.equal(parseThreshold('۲۰۰.۰۱'), 20_001);
  assert.equal(parseThreshold('0'), 0);
  assert.equal(thresholdText(20_001), '200.01');
  assert.equal(thresholdText(Number.MAX_SAFE_INTEGER), '90071992547409.91');
  assert.equal(parseThreshold('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  for (const bad of ['', '-1', '1e3', '1.234', 'Infinity', '90071992547409.92', '1,000']) assert.equal(parseThreshold(bad), null);
});

test('preferences are verified-account scoped and damaged records are rejected', () => {
  assert.notEqual(securityKey('account-a'), securityKey('account-b'));
  assert.throws(() => securityKey(''));
  const state = defaultSecurityState();
  state.hideBalances = true;
  assert.deepEqual(decodeSecurityState(JSON.stringify(state)), state);
  for (const bad of ['invalid', 'null', '{}', JSON.stringify({ ...state, thresholdMinor: 0.25 }), JSON.stringify({ ...state, pin: { pin: '1234' } }), JSON.stringify({ ...state, idleMinutes: 2 })]) {
    assert.throws(() => decodeSecurityState(bad));
  }
});

test('Home hide preference migration accepts both historical encodings', () => {
  assert.equal(legacyHideBalances('1'), true);
  assert.equal(legacyHideBalances('true'), true);
  for (const raw of [null, '0', 'false', '', 'other']) assert.equal(legacyHideBalances(raw), false);
});

test('idle activity accepts scrolling gestures, not synthetic events or unattended scroll', () => {
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchmove']) {
    assert.equal(isUserIdleActivity({ type, isTrusted: true }, 10_000, 0), true);
    assert.equal(isUserIdleActivity({ type, isTrusted: false }, 10_000, 0), false);
  }
  assert.equal(isUserIdleActivity({ type: 'scroll', isTrusted: true }, 10_000, 9_000), true);
  assert.equal(isUserIdleActivity({ type: 'scroll', isTrusted: true }, 10_000, 7_000), false);
  assert.equal(isUserIdleActivity({ type: 'scroll', isTrusted: false }, 10_000, 9_000), false);
  assert.equal(isUserIdleActivity({ type: 'pointermove', isTrusted: true, buttons: 1 }, 10_000, 0), true);
  assert.equal(isUserIdleActivity({ type: 'pointermove', isTrusted: true, buttons: 0 }, 10_000, 0), false);
});

test('PBKDF2 random salts, valid PIN range and no plaintext persistence', async () => {
  const record = await hashPin('123456');
  const second = await hashPin('123456');
  assert.notEqual(record.salt, second.salt);
  assert.notEqual(record.hash, second.hash);
  assert.equal(await verifyPin('123456', record), true);
  assert.equal(await verifyPin('123455', record), false);
  assert.equal(await verifyPin('123', record), false);
  assert.equal(record.hash.length, 64);
  assert.equal(record.salt.length, 32);
  assert.deepEqual(Object.keys(record).sort(), ['hash', 'iterations', 'salt']);
  const state = { ...defaultSecurityState(), pin: record };
  assert.deepEqual(decodeSecurityState(JSON.stringify(state)), state);
  assert.equal(normalizePin('١۲٣۴'), '1234');
  assert.equal(validPin('1234'), true);
  assert.equal(validPin('123456'), true);
  assert.equal(validPin('1234567'), false);
  await assert.rejects(() => hashPin('123'));
});

test('attempt reservation survives serialization/reload; calm cooldown expires', () => {
  const now = 10_000;
  let state = defaultSecurityState();
  for (let i = 0; i < ATTEMPT_LIMIT; i++) {
    state = decodeSecurityState(JSON.stringify(reserveAttempt(state, now)));
    assert.equal(state.attempts, i + 1);
  }
  assert.equal(remainingCooldown(state, now), COOLDOWN_MS / 1000);
  assert.throws(() => reserveAttempt(state, now + COOLDOWN_MS - 1), /cooldown/);
  assert.equal(remainingCooldown(state, now + COOLDOWN_MS), 0);
  const next = reserveAttempt(state, now + COOLDOWN_MS);
  assert.equal(next.attempts, 1);
  assert.equal(next.cooldownUntil, 0);
});