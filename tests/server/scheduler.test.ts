import assert from 'node:assert/strict';
import { test } from 'node:test';
import { systemScheduler } from '../../server/scheduler.ts';

test('never runs a timer before the clock reaches its time, even when the timer fires early', async (t) => {
  const start = Date.now();
  let clock = start;
  t.mock.method(Date, 'now', () => clock);
  const ranAt: number[] = [];
  systemScheduler.at(start + 20, () => ranAt.push(clock));
  // The timer fires after its 20 ms, but the clock still reads 1 ms short of its time.
  clock = start + 19;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(ranAt, []);
  clock = start + 20;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(ranAt, [start + 20]);
});

test('cancels a timer that is waiting out the rest of its time', async (t) => {
  const start = Date.now();
  let clock = start;
  t.mock.method(Date, 'now', () => clock);
  let ran = false;
  const cancel = systemScheduler.at(start + 20, () => (ran = true));
  clock = start + 19;
  await new Promise((resolve) => setTimeout(resolve, 40));
  cancel();
  clock = start + 30;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(ran, false);
});
