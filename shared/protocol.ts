// The protocol (docs/design-docs/system-design.md#decision): the HTTP bodies, the messages each side sends
// over the socket, the error and close codes, and one validator per message the server receives.
import { validateSettings } from './settings.ts';
import type { LobbySettings, SettingsBounds, ThemeKind, TitleLanguage } from './settings.ts';
import { hasKeys, isIntegerIn, isRecord } from './validate.ts';

// A raw name longer than this can't clean down to a valid one worth keeping.
const RAW_NAME_MAX = 200;
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;
const ROUND_ID_SHAPE = /^[A-Za-z0-9_.-]{1,64}$/;

// Lobby codes: 6 of 31 characters without look-alikes (no 0/O or 1/I/L), about 887 million codes. People
// type them, so any case is accepted.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

// The code in its stored form, or null when it can't be one.
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((char) => CODE_ALPHABET.includes(char)) ? code : null;
}

// What went wrong, for the client to explain in its own words.
export type ErrorCode =
  // HTTP responses
  | 'invalid-request'
  | 'invalid-name'
  | 'lobby-not-found'
  | 'lobby-full'
  | 'lobby-locked'
  | 'name-taken'
  | 'too-many-lobbies'
  | 'rate-limited'
  | 'server-full'
  | 'not-ready'
  | 'too-large'
  | 'not-found'
  | 'server-error'
  // Socket messages
  | 'invalid-message'
  | 'not-host'
  | 'unknown-player'
  | 'cannot-kick-self'
  | 'game-running'
  | 'pool-too-small'
  | 'server-busy';

// Why the server closed a socket. The 4000s are this protocol's own.
export const CLOSE_CODES = {
  left: 1000,
  serverClosing: 1001,
  invalidMessages: 1008,
  tooLarge: 1009,
  kicked: 4001,
  lobbyClosed: 4002,
  unknownSession: 4003,
  replaced: 4004,
} as const;

export interface NameBody {
  name: string;
}

export function parseNameBody(value: unknown): NameBody | null {
  if (!isRecord(value) || !hasKeys(value, ['name']) || typeof value.name !== 'string') return null;
  return value.name.length <= RAW_NAME_MAX ? { name: value.name } : null;
}

export type ClientMessage =
  | { type: 'hello'; sessionToken: string }
  | { type: 'time:ping'; clientTime: number }
  | { type: 'lobby:leave' }
  | { type: 'lobby:lock'; locked: boolean }
  | { type: 'player:kick'; playerId: string }
  | { type: 'settings:update'; settings: LobbySettings }
  | { type: 'game:start' }
  | { type: 'round:ready'; roundId: string; loaded: boolean }
  | { type: 'answer'; roundId: string; option: number }
  | { type: 'round:skip' };

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRoundId(value: unknown): value is string {
  return typeof value === 'string' && ROUND_ID_SHAPE.test(value);
}

// Null for anything that isn't exactly one of the messages above.
export function parseClientMessage(text: string, bounds: SettingsBounds): ClientMessage | null {
  const value = parseRecord(text);
  if (!value) return null;
  const { type } = value;
  if (type === 'hello' && hasKeys(value, ['type', 'sessionToken']) && typeof value.sessionToken === 'string') {
    return value.sessionToken.length <= 64 ? { type, sessionToken: value.sessionToken } : null;
  }
  if (type === 'time:ping' && hasKeys(value, ['type', 'clientTime']) && Number.isFinite(value.clientTime)) {
    return { type, clientTime: Number(value.clientTime) };
  }
  if ((type === 'lobby:leave' || type === 'game:start' || type === 'round:skip') && hasKeys(value, ['type'])) {
    return { type };
  }
  if (type === 'lobby:lock' && hasKeys(value, ['type', 'locked']) && typeof value.locked === 'boolean') {
    return { type, locked: value.locked };
  }
  if (type === 'player:kick' && hasKeys(value, ['type', 'playerId']) && typeof value.playerId === 'string') {
    return ID_SHAPE.test(value.playerId) ? { type, playerId: value.playerId } : null;
  }
  if (type === 'settings:update' && hasKeys(value, ['type', 'settings'])) {
    const settings = validateSettings(value.settings, bounds);
    return settings ? { type, settings } : null;
  }
  if (type === 'round:ready' && hasKeys(value, ['type', 'roundId', 'loaded']) && isRoundId(value.roundId)) {
    return typeof value.loaded === 'boolean' ? { type, roundId: value.roundId, loaded: value.loaded } : null;
  }
  if (type === 'answer' && hasKeys(value, ['type', 'roundId', 'option']) && isRoundId(value.roundId)) {
    return isIntegerIn(value.option, 0, 3) ? { type, roundId: value.roundId, option: value.option } : null;
  }
  return null;
}

// The four options' titles in each title language, in option order. Each client shows one language.
export type OptionTitles = Record<TitleLanguage, string[]>;

// An artist as the song credits them: `as` is the name they sang under, such as a character.
export interface SongCredit {
  name: string;
  as: string | null;
}

// What the reveal teaches about the answer (docs/product-specs/game-flow.md).
export interface RevealDetails {
  anime: { english: string | null; romaji: string; japanese: string | null };
  theme: { kind: ThemeKind; sequence: number };
  song: { title: string | null; artists: SongCredit[] };
  year: number | null;
  season: string | null;
  cover: string | null; // a path on this server
}

export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  spectating: boolean; // joined during a game: plays from the next round
  score: number;
}

// Where the lobby's game stands: `number` is the round in progress, or the rounds played once it's over.
export interface GameView {
  phase: 'playing' | 'results';
  number: number;
  rounds: number;
}

// Sent to each player whenever the lobby changes. `you` is the receiving player.
export interface LobbyState {
  type: 'lobby:state';
  code: string;
  you: string;
  hostId: string | null;
  locked: boolean;
  players: PlayerView[];
  settings: LobbySettings;
  pool: { themes: number; anime: number };
  bounds: SettingsBounds;
  game: GameView | null;
}

export interface Pick {
  playerId: string;
  option: number | null; // null when the player didn't answer
  points: number;
  noAudio: boolean;
}

export interface StandingView {
  playerId: string;
  score: number;
  streak: number;
}

export interface ResultView {
  playerId: string;
  score: number;
  correct: number;
  averageMs: number | null; // average response time of correct answers
  bestStreak: number;
}

export type RoundReveal = {
  type: 'round:reveal';
  roundId: string;
  skipped: boolean;
  correct: number;
  picks: Pick[];
  standings: StandingView[];
} & RevealDetails;

export type ServerMessage =
  | LobbyState
  | { type: 'round:prepare'; roundId: string; clipToken: string; number: number; rounds: number }
  | { type: 'round:start'; roundId: string; startsAt: number; endsAt: number; options: OptionTitles }
  | { type: 'round:answered'; roundId: string; playerIds: string[] }
  | RoundReveal
  | { type: 'game:results'; standings: ResultView[] }
  | { type: 'time:pong'; clientTime: number; serverTime: number }
  | { type: 'error'; code: ErrorCode }
  | { type: 'server:closing' };
