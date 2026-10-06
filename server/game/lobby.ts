// A lobby's seats, host, lock and settings (docs/product-specs/lobby.md), as pure functions over plain data.
// The registry keeps the lobbies and applies these; games join them in M5.
import { nameKey } from '../../shared/names.ts';
import { PLAYER_ICONS } from '../../shared/protocol.ts';
import type { PlayerIcon } from '../../shared/protocol.ts';
import type { LobbySettings } from '../../shared/settings.ts';

export const RECONNECT_GRACE_MS = 60_000;
export const IDLE_LOBBY_MS = 15_000;
export const MAX_LOBBY_AGE_MS = 4 * 60 * 60_000;

export interface Player {
  id: string;
  name: string;
  icon: PlayerIcon;
  connectedSince: number | null; // null while not connected
  team: number; // the player's team when the lobby plays Teams, kept in range of the settings' count
  screen: boolean; // a party mode screen, not a player: it never answers, scores, hosts or counts toward the cap
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
  daily: { number: number } | null; // a daily challenge's private lobby: locked, its settings fixed
}

export type JoinError = 'lobby-full' | 'lobby-locked' | 'name-taken';
export const MAX_SCREENS = 2;
export type TeamError = 'not-host' | 'unknown-player' | 'unknown-team';
export type HostError = 'not-host' | 'unknown-player' | 'cannot-kick-self';
export type Outcome<E> = { lobby: Lobby } | { error: E };

export function newLobby(code: string, settings: LobbySettings, now: number): Lobby {
  return { code, createdAt: now, hostId: null, players: [], locked: false, settings, idleSince: now, daily: null };
}

function isConnected(player: Player): boolean {
  return player.connectedSince !== null;
}

// The connected player who has been connected longest (join order breaks ties), or nobody.
function longestConnected(players: Player[]): string | null {
  const connected = players
    .filter((player) => isConnected(player) && !player.screen)
    .sort((a, b) => (a.connectedSince ?? 0) - (b.connectedSince ?? 0));
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
  if (playersOf(lobby).length >= maxPlayers) return { error: 'lobby-full' };
  if (lobby.players.some((player) => nameKey(player.name) === nameKey(seat.name))) return { error: 'name-taken' };
  const player: Player = {
    ...seat,
    icon: freeIcon(lobby, seat.id),
    team: smallestTeam(playersOf(lobby), lobby.settings.teams),
    screen: false,
    connectedSince: null,
    disconnectedAt: now,
  };
  return { lobby: { ...lobby, players: [...lobby.players, player], hostId: lobby.hostId ?? seat.id } };
}

// The lobby's players, without its screens.
export function playersOf(lobby: Lobby): Player[] {
  return lobby.players.filter((player) => !player.screen);
}

// A party mode screen joins by the lobby's link, without a name: "Screen", or "Screen 2" beside another. A lobby has
// at most two, and a locked lobby takes none.
export function addScreen(lobby: Lobby, id: string, now: number): Outcome<'lobby-locked' | 'screens-full'> {
  if (lobby.locked) return { error: 'lobby-locked' };
  const screens = lobby.players.filter((player) => player.screen).length;
  if (screens >= MAX_SCREENS) return { error: 'screens-full' };
  const name = screens === 0 ? 'Screen' : `Screen ${screens + 1}`;
  const screen: Player = { id, name, icon: 'fox', team: 0, screen: true, connectedSince: null, disconnectedAt: now };
  return { lobby: { ...lobby, players: [...lobby.players, screen] } };
}

// A new player's icon: one nobody in the lobby has, picked by their random id, or any once all are taken.
function freeIcon(lobby: Lobby, playerId: string): PlayerIcon {
  const taken = new Set(lobby.players.map((player) => player.icon));
  const free = PLAYER_ICONS.filter((icon) => !taken.has(icon));
  const choices = free.length > 0 ? free : PLAYER_ICONS;
  const spread = [...playerId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return choices[spread % choices.length] ?? 'fox';
}

// The team with the fewest players; the lowest number breaks a tie.
function smallestTeam(players: Player[], teams: number): number {
  const sizes = Array.from({ length: teams }, (_, team) => players.filter((player) => player.team === team).length);
  return sizes.indexOf(Math.min(...sizes));
}

// Players on a team the settings no longer have move, one by one, to the smallest team left.
function keepTeamsInRange(players: Player[], teams: number): Player[] {
  const kept = players.filter((player) => player.team < teams);
  const moved = players.filter((player) => player.team >= teams);
  const placed = [...kept];
  for (const player of moved) placed.push({ ...player, team: smallestTeam(placed, teams) });
  return players.map((player) => placed.find((candidate) => candidate.id === player.id) ?? player);
}

// A player joins a team; the host can move anyone.
export function setTeam(lobby: Lobby, actorId: string, targetId: string, team: number): Outcome<TeamError> {
  if (actorId !== targetId && lobby.hostId !== actorId) return { error: 'not-host' };
  if (!lobby.players.some((player) => player.id === targetId)) return { error: 'unknown-player' };
  if (team >= lobby.settings.teams) return { error: 'unknown-team' };
  return { lobby: updatePlayer(lobby, targetId, (player) => ({ ...player, team })) };
}

// The host deals the players out in the given order, one to each team in turn, so the teams differ by one at most.
export function shuffleTeams(lobby: Lobby, actorId: string, order: string[]): Outcome<'not-host'> {
  if (lobby.hostId !== actorId) return { error: 'not-host' };
  const teamOf = new Map(order.map((id, index) => [id, index % lobby.settings.teams]));
  return {
    lobby: {
      ...lobby,
      players: lobby.players.map((player) => ({ ...player, team: teamOf.get(player.id) ?? player.team })),
    },
  };
}

export function setIcon(lobby: Lobby, id: string, icon: PlayerIcon): Outcome<'icon-taken'> {
  if (lobby.players.some((player) => player.id !== id && player.icon === icon)) return { error: 'icon-taken' };
  return { lobby: updatePlayer(lobby, id, (player) => ({ ...player, icon })) };
}

export function connectPlayer(lobby: Lobby, id: string, now: number): Lobby {
  const connected = updatePlayer(lobby, id, (player) => ({ ...player, connectedSince: now, disconnectedAt: null }));
  // A screen never takes the host's seat.
  const screen = lobby.players.some((player) => player.id === id && player.screen);
  return withIdleSince({ ...connected, hostId: connected.hostId ?? (screen ? null : id) }, now);
}

// A dropped player keeps their seat and host rights for the reconnect grace; the game keeps their score.
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

export function lockLobby(lobby: Lobby, actorId: string, locked: boolean): Outcome<'not-host' | 'daily-fixed'> {
  if (lobby.daily) return { error: 'daily-fixed' };
  return lobby.hostId === actorId ? { lobby: { ...lobby, locked } } : { error: 'not-host' };
}

export function changeSettings(
  lobby: Lobby,
  actorId: string,
  settings: LobbySettings,
): Outcome<'not-host' | 'daily-fixed'> {
  if (lobby.hostId !== actorId) return { error: 'not-host' };
  if (lobby.daily) return { error: 'daily-fixed' };
  return { lobby: { ...lobby, settings, players: keepTeamsInRange(lobby.players, settings.teams) } };
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
