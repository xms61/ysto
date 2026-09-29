import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RateLimit } from '../../server/rate-limit.ts';

test('allows the limit within the window, per key, and again once the window moves on', () => {
  const clock = { now: 0 };
  const limit = new RateLimit(2, 60_000, () => clock.now);
  assert.equal(limit.take('a'), true);
  clock.now = 10_000;
  assert.equal(limit.take('a'), true);
  assert.equal(limit.take('a'), false);
  assert.equal(limit.exhausted('a'), true);
  assert.equal(limit.take('b'), true, 'another key has its own count');
  assert.equal(limit.retryAfterSec('a'), 50);
  clock.now = 60_001;
  assert.equal(limit.take('a'), true, 'the first event left the window');
  assert.equal(limit.retryAfterSec('c'), 0);
});
