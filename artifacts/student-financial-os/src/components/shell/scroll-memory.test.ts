import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScrollController } from './scroll-memory';

function fake() {
  const s = { url: '/', y: 0, height: 5000, vh: 844 };
  const env = {
    key: () => s.url, pathOf: (k: string) => k.split('?')[0], y: () => s.y,
    scrollTo: (y: number) => { s.y = y; }, canReach: (y: number) => y <= 0 || s.height - s.vh >= y - 2,
  };
  return { s, c: createScrollController(env) };
}

test('push captures departing page under OLD key; late old/clamp scroll cannot write into new or old key', () => {
  const { s, c } = fake();
  s.y = 1996; c.onScroll();
  s.url = '/transactions/7'; c.onNavigate('push');
  assert.equal(c.memory.get('/'), 1996);
  s.y = 0; c.onScroll(); // browser clamp while detail renders
  assert.equal(c.memory.get('/'), 1996);
  assert.equal(c.memory.has('/transactions/7'), false);
  assert.equal(c.apply(), true);
  assert.equal(s.y, 0);
  s.y = 300; c.onScroll();
  assert.equal(c.memory.get('/transactions/7'), 300);
  assert.equal(c.memory.get('/'), 1996);
});

test('pop restores target only once content is tall enough; writes frozen meanwhile', () => {
  const { s, c } = fake();
  s.y = 1996; c.onScroll();
  s.url = '/transactions/7'; c.onNavigate('push'); c.apply();
  s.url = '/'; c.onNavigate('pop');
  assert.equal(c.pending, 1996);
  s.height = 900; s.y = 0; c.onScroll(); // skeleton, clamped
  assert.equal(c.apply(), false);
  assert.equal(c.memory.get('/'), 1996);
  s.height = 3200; // queried blocks rendered
  assert.equal(c.apply(), true);
  assert.equal(s.y, 1996);
  assert.equal(c.frozen, false);
});

test('same-path replace (filters) keeps scroll and re-keys', () => {
  const { s, c } = fake();
  s.url = '/transactions'; c.onNavigate('push'); c.apply();
  s.y = 800; c.onScroll();
  s.url = '/transactions?type=food'; c.onNavigate('replace');
  assert.equal(c.frozen, false);
  assert.equal(c.memory.get('/transactions?type=food'), 800);
  assert.equal(c.memory.get('/transactions'), 800);
  assert.equal(s.y, 800);
});

test('pop to unknown key goes to top; abandon unfreezes', () => {
  const { s, c } = fake();
  s.y = 500; s.url = '/goals'; c.onNavigate('pop');
  assert.equal(c.pending, 0);
  c.abandon(); assert.equal(c.frozen, false);
});
