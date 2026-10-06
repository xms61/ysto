// The daily challenge on this device (docs/product-specs/daily.md): how many days in a row it has been played,
// the best run, and the line to share a result. Without accounts the streak lives here (`ysto_daily`), so clearing
// the browser's data resets it. Only the first play of a day counts; a replay is practice.
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

const NONE: DailyRecord = { last: 0, streak: 0, best: 0, game: '', practice: false };

export function readDaily(storage: Storage | null): DailyRecord {
  const value = readJson(storage, DAILY_KEY);
  if (!isRecord(value)) return NONE;
  const { last, streak, best, game, practice } = value;
  const valid =
    isIntegerIn(last, 0, MAX_DAY) &&
    isIntegerIn(streak, 0, MAX_DAY) &&
    isIntegerIn(best, 0, MAX_DAY) &&
    typeof game === 'string' &&
    typeof practice === 'boolean';
  return valid ? { last, streak, best, game, practice } : NONE;
}

// The run as it stands today: still alive if the last play was today or yesterday.
export function currentStreak(record: DailyRecord, today: number): number {
  return record.last >= today - 1 ? record.streak : 0;
}

// Counts a finished daily game: the next day in a row extends the streak, a gap starts it again at 1, and the same
// day again is practice. The same game shown again (a reload at its results) changes nothing.
export function recordDaily(storage: Storage | null, day: number, game: string): DailyOutcome {
  const before = readDaily(storage);
  if (before.game === game) return { record: before, practice: before.practice };
  const practice = before.last === day;
  const streak = practice ? before.streak : before.last === day - 1 ? before.streak + 1 : 1;
  const record = { last: day, streak, best: Math.max(before.best, streak), game, practice };
  writeItem(storage, DAILY_KEY, JSON.stringify(record));
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
const HEADPHONES = '\u{1F3A7}';
const FIRE = '\u{1F525}';
const ROW = 5;

function squareOf(song: PlayedSong, playerId: string): string {
  if (song.skipped) return SQUARE.skipped;
  return song.right.includes(playerId) ? SQUARE.right : SQUARE.missed;
}

// The rounds as rows of five colored squares, as Wordle shares its guesses. It names no song.
export function dailyGrid(songs: PlayedSong[], playerId: string): string[] {
  const squares = songs.map((song) => squareOf(song, playerId));
  return Array.from({ length: Math.ceil(squares.length / ROW) }, (_, row) =>
    squares.slice(row * ROW, row * ROW + ROW).join(''),
  );
}

// The line to paste into a chat such as Discord: the day, the grid, then the right answers, the score and the
// streak.
export function shareText(day: number, right: number, rounds: number, score: string, streak: number, grid: string[]) {
  const days = streak > 1 ? ` · ${FIRE} ${streak}` : '';
  return [`You Skipped The OP?! ${HEADPHONES} Daily #${day}`, ...grid, `${right}/${rounds} · ${score} pts${days}`].join(
    '\n',
  );
}
