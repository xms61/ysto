import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClipTokens } from '../../server/clips/tokens.ts';
import { isToken } from '../../server/tokens.ts';

function fakeClock(start = 0) {
  const clock = { now: start };
  return { clock, tokens: new ClipTokens(() => clock.now) };
}

test('issues a different opaque token for every clip', () => {
  const { tokens } = fakeClock();
  const issued = Array.from({ length: 50 }, () => tokens.issue('lobby', Buffer.from('clip'), 1000));
  assert.equal(new Set(issued).size, 50);
  assert.ok(issued.every(isToken));
});

test('finds a clip only for its own lobby, and only until it expires', () => {
  const { clock, tokens } = fakeClock(100);
  const audio = Buffer.from('clip');
  const token = tokens.issue('lobby-a', audio, 1000);
  assert.equal(tokens.find(token, 'lobby-a'), audio);
  assert.equal(tokens.find(token, 'lobby-b'), undefined);
  clock.now = 999;
  assert.equal(tokens.find(token, 'lobby-a'), audio);
  clock.now = 1000;
  assert.equal(tokens.find(token, 'lobby-a'), undefined);
});

test('moves a token expiry when the round sets it', () => {
  const { clock, tokens } = fakeClock();
  const token = tokens.issue('lobby', Buffer.from('clip'), 120_000);
  tokens.expireAt(token, 30_000);
  clock.now = 30_000;
  assert.equal(tokens.find(token, 'lobby'), undefined);
});

test('forgets expired clips when the next one is issued', () => {
  const { clock, tokens } = fakeClock();
  const old = tokens.issue('lobby', Buffer.from('old'), 100);
  clock.now = 100;
  tokens.issue('lobby', Buffer.from('new'), 1000);
  // A dropped entry can't come back, even if its expiry is moved later.
  tokens.expireAt(old, 5000);
  assert.equal(tokens.find(old, 'lobby'), undefined);
});
