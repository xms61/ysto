import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile, verdictOf } from '../../scripts/load/stats.ts';

const passing = { lobbies: 2, finishedGames: 2, clipMs: [100, 200, 300], pingMs: [2, 3, 40], errors: [] };

test('takes the nearest-rank percentile', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 0.5), 3);
  assert.equal(percentile([5, 1, 3, 2, 4], 0.95), 5);
  assert.ok(Number.isNaN(percentile([], 0.5)));
});

test('passes a run that finished every game under both targets', () => {
  assert.equal(verdictOf(passing).passed, true);
});

test('fails a run with an unfinished game, an error, slow clips or a slow loop', () => {
  assert.equal(verdictOf({ ...passing, finishedGames: 1 }).passed, false);
  assert.equal(verdictOf({ ...passing, errors: ['server-busy'] }).passed, false);
  assert.equal(verdictOf({ ...passing, clipMs: [100, 1200] }).passed, false);
  assert.equal(verdictOf({ ...passing, pingMs: [2, 80] }).passed, false);
});
