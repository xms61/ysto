import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addPlayer,
  changeSettings,
  connectPlayer,
  disconnectPlayer,
  expiredSeats,
  IDLE_LOBBY_MS,
  isExpired,
  kickPlayer,
  lockLobby,
  MAX_LOBBY_AGE_MS,
  newLobby,
  RECONNECT_GRACE_MS,
  removePlayer,
  setIcon,
} from '../../server/game/lobby.ts';
import type { Lobby, Outcome } from '../../server/game/lobby.ts';
import { PLAYER_ICONS } from '../../shared/protocol.ts';
import { defaultSettings } from '../../shared/settings.ts';

const settings = defaultSettings({ years: { from: 2000, to: 2020 }, genres: [], maxRank: 100 });

function lobbyOf<E>(outcome: Outcome<E>): Lobby {
  assert.ok('lobby' in outcome, `expected a lobby, got ${JSON.stringify(outcome)}`);
  return outcome.lobby;
}

// A lobby with the given players seated and connected, one second apart, in order.
function lobbyWith(names: string[]): Lobby {
  let lobby = newLobby('ABC234', settings, 0);
  names.forEach((name, index) => {
    lobby = connectPlayer(lobbyOf(addPlayer(lobby, { id: name, name }, index * 1000, 12)), name, index * 1000);
  });
  return lobby;
}

test('makes the first player the host', () => {
  const lobby = lobbyOf(addPlayer(newLobby('ABC234', settings, 0), { id: 'a', name: 'Ann' }, 0, 12));
  assert.equal(lobby.hostId, 'a');
});

test('refuses a player when the lobby is locked, full, or has the name already', () => {
  const lobby = lobbyWith(['Ann', 'Ben']);
  assert.deepEqual(addPlayer(lobby, { id: 'c', name: 'ANN' }, 5000, 12), { error: 'name-taken' });
  assert.deepEqual(addPlayer(lobby, { id: 'c', name: 'Cid' }, 5000, 2), { error: 'lobby-full' });
  assert.deepEqual(addPlayer({ ...lobby, locked: true }, { id: 'c', name: 'Cid' }, 5000, 12), {
    error: 'lobby-locked',
  });
});

test('keeps a dropped player seated, and the lobby idle only while nobody is connected', () => {
  let lobby = lobbyWith(['Ann', 'Ben']);
  assert.equal(lobby.idleSince, null);
  lobby = disconnectPlayer(lobby, 'Ann', 10_000);
  assert.deepEqual(
    lobby.players.map((player) => player.connectedSince),
    [null, 1000],
  );
  assert.equal(lobby.hostId, 'Ann', 'a dropped host stays host through the grace');
  lobby = disconnectPlayer(lobby, 'Ben', 12_000);
  assert.equal(lobby.idleSince, 12_000);
  lobby = connectPlayer(lobby, 'Ben', 20_000);
  assert.equal(lobby.idleSince, null);
});

test('hands the host to the player connected longest when the host leaves', () => {
  let lobby = lobbyWith(['Ann', 'Ben', 'Cid']);
  lobby = connectPlayer(disconnectPlayer(lobby, 'Ben', 5000), 'Ben', 6000);
  lobby = removePlayer(lobby, 'Ann', 7000);
  assert.equal(lobby.hostId, 'Cid', 'Ben reconnected at 6 s, so Cid (2 s) has been connected longer');
});

test('leaves a lobby without a host until somebody connects', () => {
  let lobby = disconnectPlayer(lobbyWith(['Ann', 'Ben']), 'Ben', 3000);
  lobby = removePlayer(lobby, 'Ann', 4000);
  assert.equal(lobby.hostId, null);
  assert.equal(connectPlayer(lobby, 'Ben', 5000).hostId, 'Ben');
});

test('lets only the host kick, lock and change settings', () => {
  const lobby = lobbyWith(['Ann', 'Ben']);
  assert.deepEqual(kickPlayer(lobby, 'Ben', 'Ann', 5000), { error: 'not-host' });
  assert.deepEqual(kickPlayer(lobby, 'Ann', 'Ann', 5000), { error: 'cannot-kick-self' });
  assert.deepEqual(kickPlayer(lobby, 'Ann', 'Zed', 5000), { error: 'unknown-player' });
  assert.deepEqual(
    lobbyOf(kickPlayer(lobby, 'Ann', 'Ben', 5000)).players.map((player) => player.id),
    ['Ann'],
  );
  assert.deepEqual(lockLobby(lobby, 'Ben', true), { error: 'not-host' });
  assert.equal(lobbyOf(lockLobby(lobby, 'Ann', true)).locked, true);
  const shorter = { ...settings, songsPerGame: 5 };
  assert.deepEqual(changeSettings(lobby, 'Ben', shorter), { error: 'not-host' });
  assert.equal(lobbyOf(changeSettings(lobby, 'Ann', shorter)).settings.songsPerGame, 5);
});

test('releases a seat once its player has been gone for the whole grace', () => {
  const lobby = disconnectPlayer(lobbyWith(['Ann', 'Ben']), 'Ben', 10_000);
  assert.deepEqual(expiredSeats(lobby, 10_000 + RECONNECT_GRACE_MS - 1), []);
  assert.deepEqual(expiredSeats(lobby, 10_000 + RECONNECT_GRACE_MS), ['Ben']);
});

test('counts the grace of a new seat from its creation', () => {
  const lobby = lobbyOf(addPlayer(newLobby('ABC234', settings, 0), { id: 'a', name: 'Ann' }, 500, 12));
  assert.deepEqual(expiredSeats(lobby, 500 + RECONNECT_GRACE_MS), ['a']);
});

test('expires a lobby idle for 15 minutes, and any lobby after 4 hours', () => {
  const idle = disconnectPlayer(lobbyWith(['Ann']), 'Ann', 1000);
  assert.equal(isExpired(idle, 1000 + IDLE_LOBBY_MS - 1), false);
  assert.equal(isExpired(idle, 1000 + IDLE_LOBBY_MS), true);
  const busy = lobbyWith(['Ann']);
  assert.equal(isExpired(busy, MAX_LOBBY_AGE_MS - 1), false);
  assert.equal(isExpired(busy, MAX_LOBBY_AGE_MS), true);
});

test('gives each new player an icon nobody else has, and shares only once every icon is taken', () => {
  const names = Array.from({ length: PLAYER_ICONS.length + 1 }, (_, index) => `p${index}`);
  let lobby = newLobby('ABC234', settings, 0);
  for (const name of names) lobby = lobbyOf(addPlayer(lobby, { id: name, name }, 0, 50));
  const icons = lobby.players.map((player) => player.icon);
  assert.equal(new Set(icons.slice(0, PLAYER_ICONS.length)).size, PLAYER_ICONS.length);
  assert.ok(PLAYER_ICONS.includes(icons.at(-1) ?? 'fox'));
});

test('lets a player switch to a free icon, never to one another player has', () => {
  const lobby = lobbyWith(['ann', 'ben']);
  const [ann, ben] = lobby.players;
  assert.ok(ann && ben);
  assert.deepEqual(setIcon(lobby, 'ann', ben.icon), { error: 'icon-taken' });
  const free = PLAYER_ICONS.find((icon) => icon !== ann.icon && icon !== ben.icon) ?? 'fox';
  assert.equal(lobbyOf(setIcon(lobby, 'ann', free)).players[0]?.icon, free);
  assert.equal(lobbyOf(setIcon(lobby, 'ann', ann.icon)).players[0]?.icon, ann.icon, 'keeping your own is fine');
});
