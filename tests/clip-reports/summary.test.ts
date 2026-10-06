import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarize } from '../../scripts/clip-reports/summary.ts';

test('lists the most reported clip first, with its reasons and where its clips started', () => {
  const rows = [
    { themeId: 7, startMs: 31_000, reason: 'silent' },
    { themeId: 9, startMs: 5_000, reason: 'bad-cut' },
    { themeId: 9, startMs: 65_000, reason: 'bad-cut' },
    { themeId: 9, startMs: 5_000, reason: 'other' },
  ] as const;
  const themeOf = (id: number) => (id === 9 ? { anime: 'Speed Line', slug: 'OP2', relPath: 'speed-OP2.ogg' } : null);
  assert.deepEqual(summarize([...rows], themeOf), [
    '4 reports on 2 clips, most reported first:',
    '3  theme 9, Speed Line OP2: bad cut 2, other 1; clips from 0:05, 1:05',
    '   speed-OP2.ogg',
    '1  theme 7, no longer in the catalog: silent 1; clips from 0:31',
  ]);
  assert.deepEqual(summarize([], themeOf), ['No reports.']);
});
