// A lobby's seats, host, lock and settings (docs/product-specs/lobby.md), as pure functions over plain data.
// The registry keeps the lobbies and applies these; games join them in M5.
import { nameKey } from '../../shared/names.ts';
import type { LobbySettings } from '../../shared/settings.ts';

export const RECONNECT_GRACE_MS = 60_000;
export const IDLE_LOBBY_MS = 15 * 60_000;
export const MAX_LOBBY_AGE_MS = 4 * 60 * 60_000;

export interface Player {
  id: string;
  name: string;
  score: number;
  connectedSince: number | null; // null while not connected
  disconnectedAt: number | null; // null while connected; a new seat counts from its creation
}

export interface Lobby {
  code: string;
  createdAt: number;
  hostId: string | null;
  players: Player[]; // in join order
  locked: boolean;
  settings: LobbySettings;
  idleSince: number | null; // since when nobody has been connected; null while somebody is
}

export type JoinError = 'lobby-full' | 'lobby-locked' | 'name-taken';
export type HostError = 'not-host' | 'unknown-player' | 'cannot-kick-self';
export type Outcome<E> = { lobby: Lobby } | { error: E };

export function newLobby(code: string, settings: LobbySettings, now: number): Lobby {
  return { code, createdAt: now, hostId: null, players: [], locked: false, settings, idleSince: now };
}

function isConnected(player: Player): boolean {
  return player.connectedSince !== null;
}

// The connected player who has been connected longest (join order breaks ties), or nobody.
function longestConnected(players: Player[]): string | null {
  const connected = players.filter(isConnected).sort((a, b) => (a.connectedSince ?? 0) - (b.connectedSince ?? 0));
  return connected[0]?.id ?? null;
}

function withIdleSince(lobby: Lobby, now: number): Lobby {
  const idleSince = lobby.players.some(isConnected) ? null : (lobby.idleSince ?? now);
  return { ...lobby, idleSince };
}

function updatePlayer(lobby: Lobby, id: string, change: (player: Player) => Player): Lobby {
  return { ...lobby, players: lobby.players.map((player) => (player.id === id ? change(player) : player)) };
}

// The first seat is the creator's, so the creator is the host. A lobby left without a host gets the next
// player who joins or connects.
export function addPlayer(
  lobby: Lobby,
  seat: { id: string; name: string },
  now: number,
  maxPlayers: number,
): Outcome<JoinError> {
  if (lobby.locked) return { error: 'lobby-locked' };
  if (lobby.players.length >= maxPlayers) return { error: 'lobby-full' };
  if (lobby.players.some((player) => nameKey(player.name) === nameKey(seat.name))) return { error: 'name-taken' };
  const player: Player = { ...seat, score: 0, connectedSince: null, disconnectedAt: now };
  return { lobby: { ...lobby, players: [...lobby.players, player], hostId: lobby.hostId ?? seat.id } };
}

export function connectPlayer(lobby: Lobby, id: string, now: number): Lobby {
  const connected = updatePlayer(lobby, id, (player) => ({ ...player, connectedSince: now, disconnectedAt: null }));
  return withIdleSince({ ...connected, hostId: connected.hostId ?? id }, now);
}

// A dropped player keeps their seat, score and host rights for the reconnect grace.
export function disconnectPlayer(lobby: Lobby, id: string, now: number): Lobby {
  const dropped = updatePlayer(lobby, id, (player) => ({ ...player, connectedSince: null, disconnectedAt: now }));
  return withIdleSince(dropped, now);
}

// When the host's seat goes, the player connected longest takes over.
export function removePlayer(lobby: Lobby, id: string, now: number): Lobby {
  const players = lobby.players.filter((player) => player.id !== id);
  const hostId = lobby.hostId === id ? longestConnected(players) : lobby.hostId;
  return withIdleSince({ ...lobby, players, hostId }, now);
}

export function kickPlayer(lobby: Lobby, actorId: string, targetId: string, now: number): Outcome<HostError> {
  if (lobby.hostId !== actorId) return { error: 'not-host' };
  if (targetId === actorId) return { error: 'cannot-kick-self' };
  if (!lobby.players.some((player) => player.id === targetId)) return { error: 'unknown-player' };
  return { lobby: removePlayer(lobby, targetId, now) };
}

export function lockLobby(lobby: Lobby, actorId: string, locked: boolean): Outcome<'not-host'> {
  return lobby.hostId === actorId ? { lobby: { ...lobby, locked } } : { error: 'not-host' };
}

export function changeSettings(lobby: Lobby, actorId: string, settings: LobbySettings): Outcome<'not-host'> {
  return lobby.hostId === actorId ? { lobby: { ...lobby, settings } } : { error: 'not-host' };
}

// Seats whose player has been gone for the whole reconnect grace.
export function expiredSeats(lobby: Lobby, now: number): string[] {
  return lobby.players
    .filter((player) => player.disconnectedAt !== null && now - player.disconnectedAt >= RECONNECT_GRACE_MS)
    .map((player) => player.id);
}

export function isExpired(lobby: Lobby, now: number): boolean {
  const idleTooLong = lobby.idleSince !== null && now - lobby.idleSince >= IDLE_LOBBY_MS;
  return idleTooLong || now - lobby.createdAt >= MAX_LOBBY_AGE_MS;
}
