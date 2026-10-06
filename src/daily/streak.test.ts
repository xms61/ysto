import { beforeEach, expect, test } from 'vitest';
import type { PlayedSong } from '../../shared/protocol.ts';
import { badgeOf, currentStreak, dailyGrid, readDaily, recordDaily, shareText } from './streak.ts';

beforeEach(() => localStorage.clear());

test('counts days in a row, starts again after a missed day, and keeps the best run', () => {
  expect(recordDaily(localStorage, 10, 'A:1').record).toMatchObject({ last: 10, streak: 1, best: 1 });
  expect(recordDaily(localStorage, 11, 'B:1').record).toMatchObject({ streak: 2, best: 2 });
  expect(recordDaily(localStorage, 12, 'C:1').record).toMatchObject({ streak: 3, best: 3 });
  expect(recordDaily(localStorage, 14, 'D:1').record).toMatchObject({ last: 14, streak: 1, best: 3 });
});

test("marks another play of the same day as practice, and doesn't count a game twice", () => {
  expect(recordDaily(localStorage, 10, 'A:1').practice).toBe(false);
  expect(recordDaily(localStorage, 10, 'A:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  expect(recordDaily(localStorage, 10, 'A:2')).toMatchObject({ practice: true, record: { streak: 1 } });
  expect(recordDaily(localStorage, 11, 'B:1')).toMatchObject({ practice: false, record: { streak: 2 } });
});

test('shows the streak as alive until a whole day is missed', () => {
  recordDaily(localStorage, 10, 'A:1');
  const record = readDaily(localStorage);
  expect(currentStreak(record, 10)).toBe(1);
  expect(currentStreak(record, 11)).toBe(1);
  expect(currentStreak(record, 12)).toBe(0);
});

test('works without storage, and ignores garbled storage', () => {
  expect(recordDaily(null, 3, 'A:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  localStorage.setItem('ysto_daily', '{"last":"x"}');
  expect(readDaily(localStorage).last).toBe(0);
});

test('gives badges at 7, 30 and 100 days', () => {
  expect([6, 7, 29, 30, 99, 100, 250].map(badgeOf)).toEqual([null, 7, 7, 30, 30, 100, 100]);
});

function song(number: number, right: string[], skipped = false): PlayedSong {
  return {
    number,
    skipped,
    right,
    anime: { english: null, romaji: 'X', japanese: null },
    theme: { kind: 'OP', sequence: 1 },
    song: { title: null, artists: [] },
    year: null,
    season: null,
    slug: 'x',
  };
}

test('shares the result as plain blocks that name no song', () => {
  const grid = dailyGrid([song(1, ['p1']), song(2, []), song(3, ['p1'], true), song(4, ['p2'])], 'p1');
  expect(grid).toBe('■□·□');
  expect(shareText(42, 8, 10, '7,450', 12, '■■□■■■·■■■')).toBe(
    'You Skipped The OP?! Daily No. 42 · 8/10 · 7,450 · day 12\n■■□■■■·■■■',
  );
});
