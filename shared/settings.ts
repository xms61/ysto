// Lobby settings: their types, limits, defaults and validator (docs/product-specs/settings.md). The one
// definition the server validates against and the client builds its forms from.
import { SCORING_MODES, SCORING_PRESETS } from './scoring.ts';
import type { ScoringRules } from './scoring.ts';
import { hasKeys, isIntegerIn, isOneOf, isRecord, isSubsetOf } from './validate.ts';

export const TITLE_LANGUAGES = ['english', 'romaji', 'japanese'] as const;
export type TitleLanguage = (typeof TITLE_LANGUAGES)[number];

export const THEME_KINDS = ['OP', 'ED'] as const;
export type ThemeKind = (typeof THEME_KINDS)[number];

export const MEDIA_FORMATS = ['TV', 'TV Short', 'Movie', 'OVA', 'ONA', 'Special'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'custom'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SAMPLE_STARTS = ['random', 'intro'] as const;
export type SampleStart = (typeof SAMPLE_STARTS)[number];

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
  answerChanges: boolean; // players may pick another option until the round closes (not in First correct)
  overtimeSec: number; // with answer changes: how long the round stays open once everyone has answered
  endless: boolean; // rounds keep coming until the host ends the game; songsPerGame doesn't apply
  hints: boolean; // halfway through a round, a player may ask when the anime aired, for 70% of the points
  play: Play;
  lives: number; // in Elimination: what each player starts with; a wrong or missed answer costs one
  teams: number; // in Teams: how many teams the players split into
  questions: QuestionKind;
  answerBy: AnswerBy; // typing names the anime, so it goes with anime questions, or their rounds in a mix
  party: boolean; // sound on one screen: a TV or laptop joins as the screen and plays the clips; phones only answer
}

// What the catalog allows: its years, the genres the settings offer, and the largest popularity rank
// (the number of playable anime).
export interface SettingsBounds {
  years: Range;
  genres: string[];
  maxRank: number;
}

// Classic scores every round; Elimination takes a life for each wrong or missed answer, and the last player
// standing wins; Teams scores each team by its members' average.
export const PLAYS = ['classic', 'elimination', 'teams'] as const;
export type Play = (typeof PLAYS)[number];

// What the options name: the anime, the song's title, its artists, or a mix drawn round by round.
export const QUESTION_KINDS = ['anime', 'song', 'artist', 'mixed'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

// How players answer: by tapping one of the four options, or by typing the anime's title.
export const ANSWER_BYS = ['options', 'typing'] as const;
export type AnswerBy = (typeof ANSWER_BYS)[number];

export const LIMITS = {
  sampleLengthSec: { min: 10, max: 30, step: 5 },
  songsPerGame: { min: 5, max: 50 },
  overtimeSec: { min: 3, max: 10 },
  lives: { min: 1, max: 5 },
  teams: { min: 2, max: 4 },
} as const;

const DEFAULT_RANK_TO = 1000;

export function defaultSettings(bounds: SettingsBounds): LobbySettings {
  return {
    sampleLengthSec: 20,
    songsPerGame: 15,
    years: { ...bounds.years },
    genres: [],
    kinds: [...THEME_KINDS],
    formats: [...MEDIA_FORMATS],
    difficulty: 'normal',
    popularityRanks: { from: 1, to: Math.min(DEFAULT_RANK_TO, bounds.maxRank) },
    sampleStart: 'random',
    scoring: { ...SCORING_PRESETS.classic },
    answerChanges: false,
    overtimeSec: 5,
    endless: false,
    hints: false,
    play: 'classic',
    lives: 3,
    teams: 2,
    questions: 'anime',
    answerBy: 'options',
    party: false,
  };
}

const SETTINGS_KEYS = [
  'sampleLengthSec',
  'songsPerGame',
  'years',
  'genres',
  'kinds',
  'formats',
  'difficulty',
  'popularityRanks',
  'sampleStart',
  'scoring',
  'answerChanges',
  'overtimeSec',
  'endless',
  'hints',
  'play',
  'lives',
  'teams',
  'questions',
  'answerBy',
  'party',
] as const;
const RANGE_KEYS = ['from', 'to'] as const;
const SCORING_KEYS = ['mode', 'streakBonus', 'comeback', 'wrongAnswerPenalty'] as const;

function isRangeWithin(value: unknown, min: number, max: number): value is Range {
  return (
    isRecord(value) &&
    hasKeys(value, RANGE_KEYS) &&
    isIntegerIn(value.from, min, max) &&
    isIntegerIn(value.to, value.from, max)
  );
}

function isSampleLength(value: unknown): value is number {
  const { min, max, step } = LIMITS.sampleLengthSec;
  return isIntegerIn(value, min, max) && value % step === 0;
}

function isNonEmptySubsetOf<T extends string>(value: unknown, allowed: readonly T[]): value is T[] {
  return isSubsetOf(value, allowed) && value.length > 0;
}

function isScoring(value: unknown): value is ScoringRules {
  return (
    isRecord(value) &&
    hasKeys(value, SCORING_KEYS) &&
    isOneOf(value.mode, SCORING_MODES) &&
    typeof value.streakBonus === 'boolean' &&
    typeof value.comeback === 'boolean' &&
    typeof value.wrongAnswerPenalty === 'boolean'
  );
}

// Null for anything a lobby can't use: a missing or extra field, a value off its range, or a genre the
// catalog doesn't offer. The result is a fresh copy, never the input object.
export function validateSettings(value: unknown, bounds: SettingsBounds): LobbySettings | null {
  if (!isRecord(value) || !hasKeys(value, SETTINGS_KEYS)) return null;
  const { sampleLengthSec, songsPerGame, years, genres, kinds, formats, difficulty, popularityRanks } = value;
  const {
    sampleStart,
    scoring,
    answerChanges,
    overtimeSec,
    endless,
    hints,
    play,
    lives,
    teams,
    questions,
    answerBy,
    party,
  } = value;
  const { songsPerGame: songs, overtimeSec: overtime } = LIMITS;
  if (
    !isSampleLength(sampleLengthSec) ||
    !isIntegerIn(songsPerGame, songs.min, songs.max) ||
    !isRangeWithin(years, bounds.years.from, bounds.years.to) ||
    !isSubsetOf(genres, bounds.genres) ||
    !isNonEmptySubsetOf(kinds, THEME_KINDS) ||
    !isNonEmptySubsetOf(formats, MEDIA_FORMATS) ||
    !isOneOf(difficulty, DIFFICULTIES) ||
    !isRangeWithin(popularityRanks, 1, bounds.maxRank) ||
    !isOneOf(sampleStart, SAMPLE_STARTS) ||
    !isScoring(scoring) ||
    typeof answerChanges !== 'boolean' ||
    !isIntegerIn(overtimeSec, overtime.min, overtime.max) ||
    typeof endless !== 'boolean' ||
    typeof hints !== 'boolean' ||
    !isOneOf(play, PLAYS) ||
    !isIntegerIn(lives, LIMITS.lives.min, LIMITS.lives.max) ||
    !isIntegerIn(teams, LIMITS.teams.min, LIMITS.teams.max) ||
    !isOneOf(questions, QUESTION_KINDS) ||
    !isOneOf(answerBy, ANSWER_BYS) ||
    typeof party !== 'boolean' ||
    // A typed answer names an anime, so song title and artist games can't use it.
    (answerBy === 'typing' && (questions === 'song' || questions === 'artist')) ||
    // First correct gives everyone but the fastest nothing, which can't decide who loses a life.
    (play === 'elimination' && isScoring(scoring) && scoring.mode === 'firstCorrect')
  ) {
    return null;
  }
  return {
    sampleLengthSec,
    songsPerGame,
    years: { from: years.from, to: years.to },
    genres: [...genres],
    kinds: [...kinds],
    formats: [...formats],
    difficulty,
    popularityRanks: { from: popularityRanks.from, to: popularityRanks.to },
    sampleStart,
    scoring: { ...scoring },
    answerChanges,
    overtimeSec,
    endless,
    hints,
    play,
    lives,
    teams,
    questions,
    answerBy,
    party,
  };
}

// First correct is a buzzer: its first answer locks, whatever the setting says.
export function answersCanChange(settings: LobbySettings): boolean {
  return settings.answerChanges && settings.scoring.mode !== 'firstCorrect';
}
