import { beforeEach, expect, test } from 'vitest';
import type { PlayedSong } from '../../shared/protocol.ts';
import { lobbyState } from '../testing/fakes.ts';
import { MAX_GAMES, animeLog, clearHistory, gameOf, logGame, readHistory } from './history.ts';
import type { LoggedGame, LoggedSong } from './history.ts';

beforeEach(() => localStorage.clear());

function played(number: number, slug: string, right: string[]): PlayedSong {
  return {
    number,
    skipped: false,
    right,
    quick: [],
    anime: { english: null, romaji: slug, japanese: null },
    theme: { kind: 'OP', sequence: 1 },
    song: { title: 'Song', artists: [] },
    year: 2020,
    season: 'Spring',
    slug,
  };
}

function logged(slug: string, right: boolean): LoggedSong {
  return { anime: { english: null, romaji: slug, japanese: null }, slug, kind: 'OP', sequence: 1, title: null, right };
}

function game(id: string, songs: LoggedSong[] = [logged('a', true)]): LoggedGame {
  return { id, at: 1, place: 1, players: 2, score: 100, songs };
}

const RESULTS = [
  { playerId: 'p2', score: 900, correct: 2, averageMs: 1000, bestStreak: 2 },
  { playerId: 'p1', score: 400, correct: 1, averageMs: 1500, bestStreak: 1 },
];

test("takes this player's place, score and right answers from the results", () => {
  const lobby = lobbyState({
    game: {
      phase: 'results',
      number: 2,
      rounds: 2,
      results: RESULTS,
      songs: [played(1, 'kon', ['p1', 'p2']), played(2, 'mob', ['p2'])],
    },
    tally: { games: 3, players: [] },
  });
  expect(gameOf(lobby, 5)).toEqual({
    id: 'ABC234:3',
    at: 5,
    place: 2,
    players: 2,
    score: 400,
    songs: [
      expect.objectContaining({ slug: 'kon', kind: 'OP', sequence: 1, title: 'Song', right: true }),
      expect.objectContaining({ slug: 'mob', right: false }),
    ],
  });
});

test('logs nothing for a player who only watched, or a game where no round played', () => {
  const songs = [played(1, 'kon', [])];
  const watched = lobbyState({ you: 'p3', game: { phase: 'results', number: 1, rounds: 1, results: RESULTS, songs } });
  expect(gameOf(watched, 1)).toBeNull();
  const empty = lobbyState({ game: { phase: 'results', number: 0, rounds: 0, results: RESULTS, songs: [] } });
  expect(gameOf(empty, 1)).toBeNull();
});

test('logs the newest game first, once, and keeps the last hundred', () => {
  logGame(localStorage, game('A:1'));
  logGame(localStorage, game('A:2'));
  logGame(localStorage, game('A:2'));
  expect(readHistory(localStorage).map((entry) => entry.id)).toEqual(['A:2', 'A:1']);
  for (let index = 0; index < MAX_GAMES + 5; index++) logGame(localStorage, game(`B:${index}`));
  const history = readHistory(localStorage);
  expect(history).toHaveLength(MAX_GAMES);
  expect(history[0]?.id).toBe(`B:${MAX_GAMES + 4}`);
});

test('reads nothing from blocked or garbled storage, and leaves out games it cannot read', () => {
  expect(readHistory(null)).toEqual([]);
  expect(logGame(null, game('A:1'))).toEqual([game('A:1')]);
  localStorage.setItem('ysto_history', '{not json');
  expect(readHistory(localStorage)).toEqual([]);
  localStorage.setItem('ysto_history', JSON.stringify([game('A:1'), { id: 'A:2', songs: 'x' }, 'x']));
  expect(readHistory(localStorage).map((entry) => entry.id)).toEqual(['A:1']);
});

test('clears the log', () => {
  logGame(localStorage, game('A:1'));
  clearHistory(localStorage);
  expect(readHistory(localStorage)).toEqual([]);
});

test('counts each anime heard and how often it was right, most heard first, then most missed', () => {
  const history = [
    game('A:2', [logged('kon', true), logged('mob', false)]),
    game('A:1', [logged('kon', false), logged('aria', true), logged('mob', false)]),
  ];
  expect(animeLog(history).map(({ slug, heard, right }) => [slug, heard, right])).toEqual([
    ['mob', 2, 0],
    ['kon', 2, 1],
    ['aria', 1, 1],
  ]);
});

test('keeps an endless game out of the log', () => {
  const songs = [played(1, 'kon', ['p1'])];
  const base = lobbyState();
  const endless = lobbyState({
    settings: { ...base.settings, endless: true },
    game: { phase: 'results', number: 1, rounds: 1, results: RESULTS, songs },
  });
  expect(gameOf(endless, 1)).toBeNull();
});
