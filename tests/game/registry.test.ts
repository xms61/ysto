import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDLE_LOBBY_MS, RECONNECT_GRACE_MS } from '../../server/game/lobby.ts';
import { poolSize } from '../../server/game/pool.ts';
import { LobbyRegistry, OPEN_LOBBIES_PER_IP } from '../../server/game/registry.ts';
import type { RegistryEvent } from '../../server/game/registry.ts';
import { createLogger } from '../../server/log.ts';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/protocol.ts';
import { syntheticCatalog } from './fixtures.ts';

const catalog = syntheticCatalog();

function setUp(maxLobbies = 100, maxPlayers = 12) {
  const clock = { now: 1_000_000 };
  const lines: string[] = [];
  const log = createLogger('info', (line) => lines.push(line));
  const registry = new LobbyRegistry({ catalog, maxLobbies, maxPlayers, log, now: () => clock.now });
  const events: RegistryEvent[] = [];
  registry.subscribe((event) => events.push(event));
  return { registry, clock, events, lines };
}

function created(registry: LobbyRegistry, name = 'Ann', ip = '10.0.0.1') {
  const result = registry.create(name, ip);
  assert.ok('code' in result, JSON.stringify(result));
  return result;
}

test('creates a lobby with a readable code, the creator as host, and default settings', () => {
  const { registry, lines } = setUp();
  const { code, playerId, sessionToken } = created(registry);
  assert.equal(code.length, CODE_LENGTH);
  assert.ok([...code].every((char) => CODE_ALPHABET.includes(char)));
  const lobby = registry.lobby(code);
  assert.equal(lobby?.hostId, playerId);
  assert.deepEqual(registry.seatOf(sessionToken), { code, playerId });
  assert.deepEqual(lobby?.settings.years, catalog.years);
  assert.deepEqual(registry.pool(lobby ?? assert.fail()), poolSize(catalog, lobby.settings));
  assert.match(lines[0] ?? '', new RegExp(`"event":"lobby.created","code":"${code}"`));
});

test('joins players and refuses unknown codes and taken names', () => {
  const { registry } = setUp();
  const { code } = created(registry);
  const joined = registry.join(code, 'Ben');
  assert.ok('playerId' in joined);
  assert.deepEqual(registry.join(code, 'ben'), { error: 'name-taken' });
  assert.deepEqual(registry.join('ZZZZZZ', 'Cid'), { error: 'lobby-not-found' });
});

test('caps lobbies per creator IP and in all', () => {
  const { registry } = setUp(OPEN_LOBBIES_PER_IP + 1);
  for (let index = 0; index < OPEN_LOBBIES_PER_IP; index++) created(registry, 'Ann', '10.0.0.1');
  assert.deepEqual(registry.create('Ann', '10.0.0.1'), { error: 'too-many-lobbies' });
  created(registry, 'Ben', '10.0.0.2');
  assert.deepEqual(registry.create('Cid', '10.0.0.3'), { error: 'server-full' });
});

test('reports connections and seat removals, and forgets the session of a removed seat', () => {
  const { registry, events } = setUp();
  const host = created(registry);
  const guest = registry.join(host.code, 'Ben');
  assert.ok('sessionToken' in guest);
  registry.connect(host.sessionToken);
  const seat = registry.connect(guest.sessionToken);
  assert.ok(seat);
  events.length = 0;
  assert.equal(registry.kick(seat, host.playerId), 'not-host');
  const hostSeat = registry.seatOf(host.sessionToken) ?? assert.fail();
  assert.equal(registry.kick(hostSeat, guest.playerId), null);
  assert.deepEqual(
    events.map((event) => event.type),
    ['seat-removed', 'changed'],
  );
  assert.deepEqual(events[0], {
    type: 'seat-removed',
    seat: { code: host.code, playerId: guest.playerId },
    reason: 'kicked',
  });
  assert.equal(registry.seatOf(guest.sessionToken), undefined, 'a kicked session is gone');
  assert.equal(registry.connect(guest.sessionToken), undefined);
});

test('hands the host over when the host leaves', () => {
  const { registry } = setUp();
  const host = created(registry);
  const guest = registry.join(host.code, 'Ben');
  assert.ok('sessionToken' in guest);
  registry.connect(host.sessionToken);
  registry.connect(guest.sessionToken);
  registry.leave(registry.seatOf(host.sessionToken) ?? assert.fail());
  assert.equal(registry.lobby(host.code)?.hostId, guest.playerId);
});

test('releases seats after the reconnect grace, then closes the lobby after 15 idle minutes', () => {
  const { registry, clock, events } = setUp();
  const host = created(registry);
  const seat = registry.connect(host.sessionToken) ?? assert.fail();
  registry.disconnect(seat);
  clock.now += RECONNECT_GRACE_MS - 1;
  registry.sweep();
  assert.ok(registry.seatOf(host.sessionToken), 'still within the grace');
  clock.now += 1;
  registry.sweep();
  assert.equal(registry.seatOf(host.sessionToken), undefined);
  assert.deepEqual(registry.lobby(host.code)?.players, []);
  clock.now += IDLE_LOBBY_MS;
  events.length = 0;
  registry.sweep();
  assert.equal(registry.lobby(host.code), undefined);
  assert.deepEqual(events, [{ type: 'closed', code: host.code }]);
  created(registry, 'Ann', '10.0.0.1');
});

test('keeps the seat of a player who reconnects within the grace', () => {
  const { registry, clock } = setUp();
  const host = created(registry);
  const seat = registry.connect(host.sessionToken) ?? assert.fail();
  registry.disconnect(seat);
  clock.now += RECONNECT_GRACE_MS - 1000;
  assert.deepEqual(registry.connect(host.sessionToken), seat);
  clock.now += RECONNECT_GRACE_MS;
  registry.sweep();
  assert.deepEqual(registry.seatOf(host.sessionToken), seat);
  assert.notEqual(registry.lobby(host.code)?.players[0]?.connectedSince, null);
});
