// Lobby settings: their types, limits and defaults (docs/product-specs/settings.md). The one definition the
// server validates against and the client builds its forms from.
import { SCORING_PRESETS } from './scoring.ts';
import type { ScoringRules } from './scoring.ts';

export const TITLE_LANGUAGES = ['english', 'romaji', 'japanese'] as const;
export type TitleLanguage = (typeof TITLE_LANGUAGES)[number];

export const THEME_KINDS = ['OP', 'ED'] as const;
export type ThemeKind = (typeof THEME_KINDS)[number];

export const MEDIA_FORMATS = ['TV', 'TV Short', 'Movie', 'OVA', 'ONA', 'Special'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'custom'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type SampleStart = 'random' | 'intro';

export interface Range {
  from: number;
  to: number;
}

export interface LobbySettings {
  sampleLengthSec: number;
  songsPerGame: number;
  years: Range;
  genres: string[]; // empty means every genre
  kinds: ThemeKind[];
  formats: MediaFormat[];
  difficulty: Difficulty;
  popularityRanks: Range; // used by 'custom' only: 1 is the most popular playable anime
  sampleStart: SampleStart;
  scoring: ScoringRules;
}

export const LIMITS = {
  sampleLengthSec: { min: 10, max: 30, step: 5 },
  songsPerGame: { min: 5, max: 50 },
} as const;

export function defaultSettings(catalogYears: Range): LobbySettings {
  return {
    sampleLengthSec: 20,
    songsPerGame: 15,
    years: { ...catalogYears },
    genres: [],
    kinds: [...THEME_KINDS],
    formats: [...MEDIA_FORMATS],
    difficulty: 'normal',
    popularityRanks: { from: 1, to: 1000 },
    sampleStart: 'random',
    scoring: { ...SCORING_PRESETS.classic },
  };
}
