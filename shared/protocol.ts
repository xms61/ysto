// The protocol (docs/design-docs/system-design.md#decision): the HTTP bodies, the messages each side sends
// over the socket, the error and close codes, and one validator per message the server receives.
import { LIMITS, validateSettings } from './settings.ts';
import type { LobbySettings, SettingsBounds, ThemeKind, TitleLanguage } from './settings.ts';
import { hasKeys, isIntegerIn, isOneOf, isRecord } from './validate.ts';

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
  | 'server-busy'
  | 'icon-taken';

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
  | { type: 'round:skip' }
  | { type: 'clip:report'; number: number; reason: ReportReason }
  | { type: 'reaction'; kind: ReactionKind }
  | { type: 'player:icon'; icon: PlayerIcon };

// Each player's mark (docs/product-specs/lobby.md): an animal, drawn the same in every theme, that stamps their
// picks at the reveal. Two players in a lobby share one only once all are taken.
export const PLAYER_ICONS = [
  'fox',
  'cat',
  'owl',
  'frog',
  'panda',
  'rabbit',
  'bear',
  'penguin',
  'tanuki',
  'octopus',
  'crane',
  'koi',
  'dog',
  'turtle',
  'hamster',
  'chick',
] as const;
export type PlayerIcon = (typeof PLAYER_ICONS)[number];

// What a player can react with, outside a round's answering (docs/product-specs/lobby.md): a fixed set,
// drawn as icons, with no free text.
export const REACTION_KINDS = ['hype', 'laugh', 'shock', 'facepalm', 'heart', 'clap'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

// Why a player reports a round's clip: fixed reasons, no free text, so nothing needs moderating.
export const REPORT_REASONS = ['silent', 'wrong-song', 'bad-cut', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

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
  if (type === 'player:icon' && hasKeys(value, ['type', 'icon'])) {
    return isOneOf(value.icon, PLAYER_ICONS) ? { type, icon: value.icon } : null;
  }
  if (type === 'reaction' && hasKeys(value, ['type', 'kind'])) {
    return isOneOf(value.kind, REACTION_KINDS) ? { type, kind: value.kind } : null;
  }
  if (type === 'clip:report' && hasKeys(value, ['type', 'number', 'reason'])) {
    const { number, reason } = value;
    const valid = isIntegerIn(number, 1, LIMITS.songsPerGame.max) && isOneOf(reason, REPORT_REASONS);
    return valid ? { type, number, reason } : null;
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
  slug: string; // the anime's page on AnimeThemes: https://animethemes.moe/anime/<slug>
  cover: string | null; // a path on this server
}

// A song the game played, for the list at the results. A skipped round's song is listed too. `right` names the
// players who picked the anime, sent only once the game is over.
export type PlayedSong = Omit<RevealDetails, 'cover'> & { number: number; skipped: boolean; right: string[] };

export interface PlayerView {
  id: string;
  name: string;
  icon: PlayerIcon;
  connected: boolean;
  spectating: boolean; // joined during a game: plays from the next round
  score: number;
}

// Where the lobby's game stands: `number` is the round in progress, or the rounds played once it's over.
// Once it's over, `results` holds the final ranking, so a player who reconnects still sees it.
export interface GameView {
  phase: 'playing' | 'results';
  number: number;
  rounds: number;
  results: ResultView[] | null;
  songs: PlayedSong[] | null; // with the results: the songs in the order they played
}

// The lobby's tally across its games: how many were played, and each player's wins (a shared first place
// counts for each) and points. Players who left are not in it.
export interface TallyView {
  games: number;
  players: { playerId: string; wins: number; points: number }[];
}

// Sent to each player whenever the lobby changes. `you` is the receiving player.
export interface LobbyState {
  type: 'lobby:state';
  version: string; // the server's build; a page of another build reloads
  code: string;
  you: string;
  hostId: string | null;
  locked: boolean;
  players: PlayerView[];
  settings: LobbySettings;
  pool: { themes: number; anime: number };
  bounds: SettingsBounds;
  game: GameView | null;
  tally: TallyView | null; // null until the lobby finishes a game
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
  // With answer changes on: someone picked another option (never which), the overtime once everyone has
  // answered, and a returning player's own pick.
  | { type: 'round:switched'; roundId: string; playerId: string }
  | { type: 'round:overtime'; roundId: string; startsAt: number; endsAt: number }
  | { type: 'round:pick'; roundId: string; option: number }
  | RoundReveal
  | { type: 'game:results'; standings: ResultView[] }
  | { type: 'reaction'; playerId: string; kind: ReactionKind }
  | { type: 'time:pong'; clientTime: number; serverTime: number }
  | { type: 'error'; code: ErrorCode }
  | { type: 'server:closing' };
