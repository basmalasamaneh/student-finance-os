import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReachScroll, clampSwipe, resolveSheetRelease, settleSwipe } from './gesture-math';

test('swipe clamps toward reveal side only (LTR/RTL)', () => {
  assert.equal(clampSwipe(0, -200, 88, -1), -112);
  assert.equal(clampSwipe(0, 50, 88, -1), 0);
  assert.equal(clampSwipe(0, 200, 88, 1), 112);
  assert.equal(clampSwipe(0, -50, 88, 1), 0);
});
test('swipe settles open past half width', () => {
  assert.equal(settleSwipe(-60, 88, -1), -88);
  assert.equal(settleSwipe(-30, 88, -1), 0);
  assert.equal(settleSwipe(60, 88, 1), 88);
});
test('sheet release', () => {
  const vh = 800;
  assert.deepEqual(resolveSheetRelease({ dy: 10, v: 0.1, h: 700, vh, snap: 'full' }), { kind: 'reset' });
  assert.deepEqual(resolveSheetRelease({ dy: 300, v: 0.3, h: 700, vh, snap: 'full' }), { kind: 'snap', to: 'half' });
  assert.deepEqual(resolveSheetRelease({ dy: 300, v: 0.3, h: 400, vh, snap: 'half' }), { kind: 'dismiss' });
  assert.deepEqual(resolveSheetRelease({ dy: -60, v: 0.3, h: 400, vh, snap: 'half' }), { kind: 'snap', to: 'full' });
  assert.deepEqual(resolveSheetRelease({ dy: 150, v: 0.2, h: 300, vh, snap: 'full' }), { kind: 'dismiss' }); // short sheet: no half
  assert.deepEqual(resolveSheetRelease({ dy: 60, v: 1.2, h: 700, vh, snap: 'full' }), { kind: 'dismiss' }); // fling
});
test('scroll restore waits for content height', () => {
  assert.equal(canReachScroll(1607, 1200, 844), false);
  assert.equal(canReachScroll(1607, 2451, 844), true);
  assert.equal(canReachScroll(0, 500, 844), true);
});
