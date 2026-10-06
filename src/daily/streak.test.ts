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

const RIGHT = '\u{1F7E9}';
const MISSED = '\u{1F7E5}';
const SKIPPED = '\u{2B1B}';

test('shares the result as one line of squares that names no song', () => {
  const songs = [
    song(1, ['p1']),
    song(2, []),
    song(3, ['p1'], true),
    song(4, ['p2']),
    song(5, ['p1']),
    song(6, ['p1', 'p2']),
  ];
  const grid = dailyGrid(songs, 'p1');
  expect(grid).toBe(RIGHT + MISSED + SKIPPED + MISSED + RIGHT + RIGHT);
  expect(shareText(42, 7, 10, '6,850', 12, 'abcd')).toBe(
    'You Skipped The OP?!\nDaily #42\n\nabcd\n\n7/10 · 6,850 pts · \u{1F525} 12',
  );
  expect(shareText(1, 3, 10, '900', 1, 'ab')).toBe('You Skipped The OP?!\nDaily #1\n\nab\n\n3/10 · 900 pts');
});
