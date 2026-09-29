import assert from 'node:assert/strict';
import { test } from 'node:test';
import { concurrencyLimit } from '../../server/clips/limit.ts';

// A job that runs until the test releases it, recording when it started.
function heldJobs(started: number[]) {
  const releases: (() => void)[] = [];
  const job = (id: number) => () =>
    new Promise<number>((resolve) => {
      started.push(id);
      releases.push(() => resolve(id));
    });
  const releaseOldest = () => releases.shift()?.();
  return { job, releaseOldest };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick++) await Promise.resolve();
}

test('runs at most the limit at once, and the rest in arrival order', async () => {
  const limit = concurrencyLimit(2);
  const started: number[] = [];
  const { job, releaseOldest } = heldJobs(started);
  const results = [1, 2, 3, 4].map((id) => limit(job(id)));
  await settle();
  assert.deepEqual(started, [1, 2]);
  releaseOldest();
  await settle();
  assert.deepEqual(started, [1, 2, 3]);
  // A job that arrives later waits behind the ones already queued.
  releaseOldest();
  const late = limit(job(5));
  await settle();
  assert.deepEqual(started, [1, 2, 3, 4]);
  for (let remaining = 0; remaining < 3; remaining++) {
    releaseOldest();
    await settle();
  }
  assert.deepEqual(await Promise.all([...results, late]), [1, 2, 3, 4, 5]);
  assert.deepEqual(started, [1, 2, 3, 4, 5]);
});

test('frees the slot of a job that fails, and passes its error on', async () => {
  const limit = concurrencyLimit(1);
  const failing = limit(() => Promise.reject(new Error('ffmpeg failed')));
  const next = limit(() => Promise.resolve('next ran'));
  await assert.rejects(failing, /ffmpeg failed/);
  assert.equal(await next, 'next ran');
});
