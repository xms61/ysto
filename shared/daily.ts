// The daily challenges (docs/product-specs/daily.md): three a UTC day, ten openings, ten endings and ten of either,
// each the same for everyone and played solo with fixed settings. Shared so the server builds the day's games and
// the client counts the day and the streaks alike.
import { SCORING_PRESETS } from './scoring.ts';
import { defaultSettings } from './settings.ts';
import type { LobbySettings, SettingsBounds, ThemeKind } from './settings.ts';

export const DAILY_MODES = ['openings', 'endings', 'both'] as const;
export type DailyMode = (typeof DAILY_MODES)[number];

// A daily's private lobby: its day and which daily.
export interface DailyLobby {
  number: number;
  mode: DailyMode;
}

const MODE_KINDS: Record<DailyMode, ThemeKind[]> = { openings: ['OP'], endings: ['ED'], both: ['OP', 'ED'] };

const DAY_MS = 24 * 60 * 60 * 1000;
// Daily No. 1 is this UTC day.
const FIRST_DAY_MS = Date.UTC(2026, 9, 1);

// The day's number, counted from the first daily; it changes at 00:00 UTC.
export function dailyNumber(nowMs: number): number {
  return Math.floor((nowMs - FIRST_DAY_MS) / DAY_MS) + 1;
}

export function dailySettings(bounds: SettingsBounds, mode: DailyMode): LobbySettings {
  return {
    ...defaultSettings(bounds),
    kinds: [...MODE_KINDS[mode]],
    songsPerGame: 10,
    sampleLengthSec: 15,
    difficulty: 'normal',
    sampleStart: 'random',
    scoring: { ...SCORING_PRESETS.classic },
  };
}
