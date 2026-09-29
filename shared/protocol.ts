// The lobby protocol (docs/design-docs/system-design.md#decision): the HTTP bodies, the messages each side
// sends over the socket, the error and close codes, and one validator per message the server receives.
// Games add their messages in M5.
import { validateSettings } from './settings.ts';
import type { LobbySettings, SettingsBounds } from './settings.ts';
import { hasKeys, isRecord } from './validate.ts';

// A raw name longer than this can't clean down to a valid one worth keeping.
const RAW_NAME_MAX = 200;
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

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
  | 'cannot-kick-self';

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
  | { type: 'settings:update'; settings: LobbySettings };

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
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
  if (type === 'lobby:leave' && hasKeys(value, ['type'])) return { type };
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
  return null;
}

export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  score: number;
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
}

export type ServerMessage =
  | LobbyState
  | { type: 'time:pong'; clientTime: number; serverTime: number }
  | { type: 'error'; code: ErrorCode }
  | { type: 'server:closing' };
