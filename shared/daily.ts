// The daily challenge (docs/product-specs/daily.md): the same ten songs for everyone each UTC day, played solo with
// fixed settings. Shared so the server builds the day's game and the client counts the day and the streak alike.
import { SCORING_PRESETS } from './scoring.ts';
import { defaultSettings } from './settings.ts';
import type { LobbySettings, SettingsBounds } from './settings.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
// Daily No. 1 is this UTC day.
const FIRST_DAY_MS = Date.UTC(2026, 9, 1);

// The day's number, counted from the first daily; it changes at 00:00 UTC.
export function dailyNumber(nowMs: number): number {
  return Math.floor((nowMs - FIRST_DAY_MS) / DAY_MS) + 1;
}

export function dailySettings(bounds: SettingsBounds): LobbySettings {
  return {
    ...defaultSettings(bounds),
    songsPerGame: 10,
    sampleLengthSec: 15,
    difficulty: 'normal',
    sampleStart: 'random',
    scoring: { ...SCORING_PRESETS.classic },
  };
}
