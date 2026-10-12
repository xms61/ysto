// The daily challenges on this device (docs/product-specs/daily.md): for each daily, how many days in a row it has
// been played and the best run, and the line to share a result. Without accounts the streaks live here
// (`ysto_daily`), so clearing the browser's data resets them. Only a daily's first play of a day counts; a replay is
// practice.
import type { DailyMode } from '../../shared/daily.ts';
import { isIntegerIn, isRecord } from '../../shared/validate.ts';
import type { PlayedSong } from '../../shared/protocol.ts';
import { readJson, writeItem } from '../storage.ts';

// Released storage keys are permanent.
const DAILY_KEY = 'ysto_daily';
const MAX_DAY = 1_000_000;

export interface DailyRecord {
  last: number; // the last day played, 0 for none
  streak: number; // days in a row up to `last`
  best: number;
  game: string; // the last daily game counted, so showing its result again doesn't count it twice
  practice: boolean; // that game replayed a day already played
}

export interface DailyOutcome {
  record: DailyRecord;
  practice: boolean; // the day was already played on this device
}

type DailyRecords = Record<DailyMode, DailyRecord>;

export const DAILY_LABELS: Record<DailyMode, string> = { openings: 'Openings', endings: 'Endings', both: 'Both' };
export const DAILY_SONGS: Record<DailyMode, string> = {
  openings: 'Ten openings',
  endings: 'Ten endings',
  both: 'Ten openings or endings',
};

const NONE: DailyRecord = { last: 0, streak: 0, best: 0, game: '', practice: false };

function recordFrom(value: unknown): DailyRecord | null {
  if (!isRecord(value)) return null;
  const { last, streak, best, game, practice } = value;
  const valid =
    isIntegerIn(last, 0, MAX_DAY) &&
    isIntegerIn(streak, 0, MAX_DAY) &&
    isIntegerIn(best, 0, MAX_DAY) &&
    typeof game === 'string' &&
    typeof practice === 'boolean';
  return valid ? { last, streak, best, game, practice } : null;
}

// One record per daily. Before there were three, the key held a single record: the daily now called Both.
function readAll(storage: Storage | null): DailyRecords {
  const value = readJson(storage, DAILY_KEY);
  const single = recordFrom(value);
  if (single) return { openings: NONE, endings: NONE, both: single };
  const stored = isRecord(value) ? value : {};
  return {
    openings: recordFrom(stored.openings) ?? NONE,
    endings: recordFrom(stored.endings) ?? NONE,
    both: recordFrom(stored.both) ?? NONE,
  };
}

export function readDaily(storage: Storage | null, mode: DailyMode): DailyRecord {
  return readAll(storage)[mode];
}

// The run as it stands today: still alive if the last play was today or yesterday.
export function currentStreak(record: DailyRecord, today: number): number {
  return record.last >= today - 1 ? record.streak : 0;
}

// Counts a finished game of one daily and leaves the other dailies' streaks alone: the next day in a row extends
// its streak, a gap starts it again at 1, and the same day again is practice. The same game shown again (a reload
// at its results) changes nothing.
export function recordDaily(storage: Storage | null, mode: DailyMode, day: number, game: string): DailyOutcome {
  const all = readAll(storage);
  const before = all[mode];
  if (before.game === game) return { record: before, practice: before.practice };
  const practice = before.last === day;
  const streak = practice ? before.streak : before.last === day - 1 ? before.streak + 1 : 1;
  const record = { last: day, streak, best: Math.max(before.best, streak), game, practice };
  writeItem(storage, DAILY_KEY, JSON.stringify({ ...all, [mode]: record }));
  return { record, practice };
}

// A streak's badge at 7, 30 and 100 days in a row.
export function badgeOf(streak: number): number | null {
  return [100, 30, 7].find((days) => streak >= days) ?? null;
}

// The share grid's squares, written as escapes to keep emoji out of the code. Black shows as grey in Discord.
const SQUARE = {
  right: '\u{1F7E9}', // green
  missed: '\u{1F7E5}', // red: wrong or no answer
  skipped: '\u{2B1B}', // grey: the host skipped the round
};
const FIRE = '\u{1F525}';

function squareOf(song: PlayedSong, playerId: string): string {
  if (song.skipped) return SQUARE.skipped;
  return song.right.includes(playerId) ? SQUARE.right : SQUARE.missed;
}

// The rounds as one line of colored squares, as Wordle shares its guesses. It names no song.
export function dailyGrid(songs: PlayedSong[], playerId: string): string {
  return songs.map((song) => squareOf(song, playerId)).join('');
}

export interface DailyShare {
  day: number;
  mode: DailyMode;
  right: number;
  rounds: number;
  score: string;
  streak: number; // this daily's
  grid: string;
}

// The text to paste into a chat such as Discord: the game, the day and the daily, the grid, then the right answers,
// the score and the streak, with a blank line between them.
export function shareText({ day, mode, right, rounds, score, streak, grid }: DailyShare): string {
  const days = streak > 1 ? ` · ${FIRE} ${streak}` : '';
  const heading = `Daily #${day} · ${DAILY_LABELS[mode]}`;
  return `You Skipped The OP?!\n${heading}\n\n${grid}\n\n${right}/${rounds} · ${score} pts${days}`;
}
