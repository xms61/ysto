import { beforeEach, expect, test } from 'vitest';
import type { PlayedSong } from '../../shared/protocol.ts';
import { badgeOf, currentStreak, dailyGrid, readDaily, recordDaily, shareText } from './streak.ts';

beforeEach(() => localStorage.clear());

test('counts days in a row, starts again after a missed day, and keeps the best run', () => {
  expect(recordDaily(localStorage, 'both', 10, 'A:1').record).toMatchObject({ last: 10, streak: 1, best: 1 });
  expect(recordDaily(localStorage, 'both', 11, 'B:1').record).toMatchObject({ streak: 2, best: 2 });
  expect(recordDaily(localStorage, 'both', 12, 'C:1').record).toMatchObject({ streak: 3, best: 3 });
  expect(recordDaily(localStorage, 'both', 14, 'D:1').record).toMatchObject({ last: 14, streak: 1, best: 3 });
});

test("marks another play of the same day as practice, and doesn't count a game twice", () => {
  expect(recordDaily(localStorage, 'both', 10, 'A:1').practice).toBe(false);
  expect(recordDaily(localStorage, 'both', 10, 'A:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  expect(recordDaily(localStorage, 'both', 10, 'A:2')).toMatchObject({ practice: true, record: { streak: 1 } });
  expect(recordDaily(localStorage, 'both', 11, 'B:1')).toMatchObject({ practice: false, record: { streak: 2 } });
});

test('shows the streak as alive until a whole day is missed', () => {
  recordDaily(localStorage, 'both', 10, 'A:1');
  const record = readDaily(localStorage, 'both');
  expect(currentStreak(record, 10)).toBe(1);
  expect(currentStreak(record, 11)).toBe(1);
  expect(currentStreak(record, 12)).toBe(0);
});

test('works without storage, and ignores garbled storage', () => {
  expect(recordDaily(null, 'both', 3, 'A:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  localStorage.setItem('ysto_daily', '{"last":"x"}');
  expect(readDaily(localStorage, 'both').last).toBe(0);
});

test("counts each daily's streak apart from the others", () => {
  recordDaily(localStorage, 'openings', 10, 'A:1');
  recordDaily(localStorage, 'openings', 11, 'B:1');
  expect(recordDaily(localStorage, 'endings', 11, 'C:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  expect(recordDaily(localStorage, 'both', 11, 'D:1')).toMatchObject({ practice: false, record: { streak: 1 } });
  expect(readDaily(localStorage, 'openings')).toMatchObject({ last: 11, streak: 2, best: 2 });
  expect(recordDaily(localStorage, 'endings', 11, 'E:1').practice).toBe(true);
  expect(readDaily(localStorage, 'openings').streak).toBe(2);
});

test('reads the one record from before the three dailies as Both', () => {
  const before = { last: 9, streak: 4, best: 6, game: 'A:1', practice: false };
  localStorage.setItem('ysto_daily', JSON.stringify(before));
  expect(readDaily(localStorage, 'both')).toEqual(before);
  expect(readDaily(localStorage, 'openings').last).toBe(0);
  expect(recordDaily(localStorage, 'both', 10, 'B:1').record).toMatchObject({ streak: 5, best: 6 });
  expect(recordDaily(localStorage, 'endings', 10, 'C:1').record.streak).toBe(1);
  expect(readDaily(localStorage, 'both').streak).toBe(5);
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
  const share = { day: 42, mode: 'endings', right: 7, rounds: 10, score: '6,850', streak: 12, grid: 'abcd' } as const;
  expect(shareText(share)).toBe('You Skipped The OP?!\nDaily #42 · Endings\n\nabcd\n\n7/10 · 6,850 pts · \u{1F525} 12');
  expect(shareText({ ...share, day: 1, mode: 'both', right: 3, score: '900', streak: 1, grid: 'ab' })).toBe(
    'You Skipped The OP?!\nDaily #1 · Both\n\nab\n\n3/10 · 900 pts',
  );
});
