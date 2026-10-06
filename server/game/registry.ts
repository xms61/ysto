// The lobbies of this process and their sessions (docs/product-specs/lobby.md). It makes lobby codes, player
// ids and session tokens, applies the lobby functions, enforces the caps, expires seats and lobbies in its
// sweep, and reports every change to one listener: the realtime layer, which tells the players.
import { randomBytes, randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/protocol.ts';
import { defaultSettings } from '../../shared/settings.ts';
import type { LobbySettings, SettingsBounds } from '../../shared/settings.ts';
import type { PlayerIcon } from '../../shared/protocol.ts';
import type { Catalog } from '../catalog/load.ts';
import type { Logger } from '../log.ts';
import { newToken } from '../tokens.ts';
import {
  addPlayer,
  changeSettings,
  connectPlayer,
  disconnectPlayer,
  expiredSeats,
  isExpired,
  kickPlayer,
  lockLobby,
  newLobby,
  removePlayer,
  setIcon,
  setTeam,
  shuffleTeams,
} from './lobby.ts';
import type { HostError, JoinError, Lobby, Outcome, TeamError } from './lobby.ts';
import { poolSize, settingsBounds } from './pool.ts';

export const OPEN_LOBBIES_PER_IP = 3;
const PLAYER_ID_BYTES = 9;

export interface Seat {
  code: string;
  playerId: string;
}

export type SeatRemoval = 'left' | 'kicked' | 'expired';

export type RegistryEvent =
  | { type: 'changed'; lobby: Lobby }
  | { type: 'seat-removed'; seat: Seat; reason: SeatRemoval }
  | { type: 'closed'; code: string };

export interface RegistryOptions {
  catalog: Catalog;
  maxLobbies: number;
  maxPlayers: number;
  log: Logger;
  now?: () => number;
}

export interface Joined {
  playerId: string;
  sessionToken: string;
}

// A fair shuffle (Fisher-Yates) with the system's random numbers.
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

export class LobbyRegistry {
  readonly bounds: SettingsBounds;
  readonly #catalog: Catalog;
  readonly #maxLobbies: number;
  readonly #maxPlayers: number;
  readonly #log: Logger;
  readonly #now: () => number;
  readonly #lobbies = new Map<string, Lobby>();
  readonly #creatorIps = new Map<string, string>();
  readonly #seats = new Map<string, Seat>(); // by session token
  readonly #tokens = new Map<string, string>(); // session token by player id
  readonly #listeners: ((event: RegistryEvent) => void)[] = [];

  constructor({ catalog, maxLobbies, maxPlayers, log, now = Date.now }: RegistryOptions) {
    this.#catalog = catalog;
    this.#maxLobbies = maxLobbies;
    this.#maxPlayers = maxPlayers;
    this.#log = log;
    this.#now = now;
    this.bounds = settingsBounds(catalog);
  }

  subscribe(listener: (event: RegistryEvent) => void): void {
    this.#listeners.push(listener);
  }

  create(name: string, ip: string): (Joined & { code: string }) | { error: 'server-full' | 'too-many-lobbies' } {
    if (this.#lobbies.size >= this.#maxLobbies) return { error: 'server-full' };
    const openFromIp = [...this.#creatorIps.values()].filter((creator) => creator === ip).length;
    if (openFromIp >= OPEN_LOBBIES_PER_IP) return { error: 'too-many-lobbies' };
    const code = this.#newCode();
    this.#lobbies.set(code, newLobby(code, defaultSettings(this.bounds), this.#now()));
    this.#creatorIps.set(code, ip);
    this.#log.info('lobby.created', { code });
    const joined = this.join(code, name);
    // An empty, unlocked lobby always seats its first player.
    if ('error' in joined) throw new Error(`A new lobby refused its creator: ${joined.error}`);
    return { code, ...joined };
  }

  join(code: string, name: string): Joined | { error: 'lobby-not-found' | JoinError } {
    const lobby = this.#lobbies.get(code);
    if (!lobby) return { error: 'lobby-not-found' };
    const playerId = randomBytes(PLAYER_ID_BYTES).toString('base64url');
    const outcome = addPlayer(lobby, { id: playerId, name }, this.#now(), this.#maxPlayers);
    if ('error' in outcome) return outcome;
    const sessionToken = newToken();
    this.#seats.set(sessionToken, { code, playerId });
    this.#tokens.set(playerId, sessionToken);
    this.#store(outcome.lobby);
    return { playerId, sessionToken };
  }

  seatOf(sessionToken: string): Seat | undefined {
    return this.#seats.get(sessionToken);
  }

  lobby(code: string): Lobby | undefined {
    return this.#lobbies.get(code);
  }

  pool(lobby: Lobby): { themes: number; anime: number } {
    return poolSize(this.#catalog, lobby.settings);
  }

  connect(sessionToken: string): Seat | undefined {
    const seat = this.#seats.get(sessionToken);
    const lobby = seat && this.#lobbies.get(seat.code);
    if (!seat || !lobby) return undefined;
    this.#store(connectPlayer(lobby, seat.playerId, this.#now()));
    return seat;
  }

  disconnect(seat: Seat): void {
    const lobby = this.#lobbies.get(seat.code);
    if (lobby) this.#store(disconnectPlayer(lobby, seat.playerId, this.#now()));
  }

  leave(seat: Seat): void {
    const lobby = this.#lobbies.get(seat.code);
    if (lobby) this.#removeSeat(removePlayer(lobby, seat.playerId, this.#now()), seat, 'left');
  }

  kick(seat: Seat, targetId: string): HostError | null {
    const lobby = this.#lobbies.get(seat.code);
    if (!lobby) return null;
    const outcome = kickPlayer(lobby, seat.playerId, targetId, this.#now());
    if ('error' in outcome) return outcome.error;
    this.#removeSeat(outcome.lobby, { code: seat.code, playerId: targetId }, 'kicked');
    return null;
  }

  lock(seat: Seat, locked: boolean): 'not-host' | null {
    return this.#applyAsHost(seat, (lobby) => lockLobby(lobby, seat.playerId, locked));
  }

  setIcon(seat: Seat, icon: PlayerIcon): 'icon-taken' | null {
    const lobby = this.#lobbies.get(seat.code);
    if (!lobby) return null;
    const outcome = setIcon(lobby, seat.playerId, icon);
    if ('error' in outcome) return outcome.error;
    this.#store(outcome.lobby);
    return null;
  }

  setTeam(seat: Seat, targetId: string, team: number): TeamError | null {
    return this.#applyAsHost(seat, (lobby) => setTeam(lobby, seat.playerId, targetId, team));
  }

  shuffleTeams(seat: Seat): 'not-host' | null {
    return this.#applyAsHost(seat, (lobby) =>
      shuffleTeams(lobby, seat.playerId, shuffled(lobby.players.map((player) => player.id))),
    );
  }

  updateSettings(seat: Seat, settings: LobbySettings): 'not-host' | null {
    return this.#applyAsHost(seat, (lobby) => changeSettings(lobby, seat.playerId, settings));
  }

  // Releases seats past their reconnect grace, then closes idle and old lobbies.
  sweep(): void {
    const now = this.#now();
    for (const lobby of [...this.#lobbies.values()]) {
      let current = lobby;
      for (const playerId of expiredSeats(current, now)) {
        current = removePlayer(current, playerId, now);
        this.#removeSeat(current, { code: current.code, playerId }, 'expired');
      }
      if (isExpired(current, now)) this.#close(current);
    }
  }

  #applyAsHost<E>(seat: Seat, apply: (lobby: Lobby) => Outcome<E>): E | null {
    const lobby = this.#lobbies.get(seat.code);
    if (!lobby) return null;
    const outcome = apply(lobby);
    if ('error' in outcome) return outcome.error;
    this.#store(outcome.lobby);
    return null;
  }

  #emit(event: RegistryEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  #store(lobby: Lobby): void {
    this.#lobbies.set(lobby.code, lobby);
    this.#emit({ type: 'changed', lobby });
  }

  #removeSeat(lobby: Lobby, seat: Seat, reason: SeatRemoval): void {
    const token = this.#tokens.get(seat.playerId);
    if (token !== undefined) this.#seats.delete(token);
    this.#tokens.delete(seat.playerId);
    this.#emit({ type: 'seat-removed', seat, reason });
    this.#store(lobby);
  }

  #close(lobby: Lobby): void {
    for (const player of lobby.players) {
      const token = this.#tokens.get(player.id);
      if (token !== undefined) this.#seats.delete(token);
      this.#tokens.delete(player.id);
    }
    this.#lobbies.delete(lobby.code);
    this.#creatorIps.delete(lobby.code);
    this.#log.info('lobby.closed', { code: lobby.code });
    this.#emit({ type: 'closed', code: lobby.code });
  }

  #newCode(): string {
    for (;;) {
      const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      if (!this.#lobbies.has(code)) return code;
    }
  }
}
