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

// The rounds as plain block characters, never emoji: right, missed, or skipped.
export function dailyGrid(songs: PlayedSong[], playerId: string): string {
  return songs.map((song) => (song.skipped ? '·' : song.right.includes(playerId) ? '■' : '□')).join('');
}

export function shareText(
  day: number,
  right: number,
  rounds: number,
  score: string,
  streak: number,
  grid: string,
): string {
  return `You Skipped The OP?! Daily No. ${day} · ${right}/${rounds} · ${score} · day ${streak}\n${grid}`;
}
