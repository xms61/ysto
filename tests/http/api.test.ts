import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../../server/app.ts';
import { API_LIMITS } from '../../server/http/api.ts';
import { SECURITY_HEADERS } from '../../server/http/headers.ts';
import { createLogger } from '../../server/log.ts';
import { isToken } from '../../server/tokens.ts';
import { createLobby, startServer } from '../server/harness.ts';
import type { TestServer } from '../server/harness.ts';

let server: TestServer;
before(async () => {
  server = await startServer({ maxPlayers: 3, trustedProxyHops: 1 });
});
after(() => server.close());

// Each test acts from its own address, so the per-IP limits of one test don't reach another.
let nextAddress = 1;
function fromNewAddress(): Record<string, string> {
  return { 'x-forwarded-for': `203.0.113.${nextAddress++}` };
}

async function errorOf(response: Response): Promise<[number, unknown]> {
  return [response.status, ((await response.json()) as { error?: unknown }).error];
}

test('creates a lobby and returns an uncached session for the creator', async () => {
  const response = await server.post('/api/lobbies', { name: ' Ann ' }, fromNewAddress());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = (await response.json()) as { code: string; playerId: string; sessionToken: string };
  assert.ok(isToken(body.sessionToken));
  const lobby = server.registry.lobby(body.code);
  assert.deepEqual(
    lobby?.players.map((player) => player.name),
    ['Ann'],
  );
});

test('joins a lobby by its code in any case', async () => {
  const { code } = await createLobby(server, 'Ann', fromNewAddress());
  const response = await server.post(`/api/lobbies/${code.toLowerCase()}/players`, { name: 'Ben' }, fromNewAddress());
  assert.equal(response.status, 201);
  const body = (await response.json()) as { playerId: string };
  assert.ok(server.registry.lobby(code)?.players.some((player) => player.id === body.playerId));
});

test('explains each refused join', async () => {
  const headers = fromNewAddress();
  const { code } = await createLobby(server, 'Ann', fromNewAddress());
  const join = (name: unknown, lobbyCode = code) => server.post(`/api/lobbies/${lobbyCode}/players`, { name }, headers);
  assert.deepEqual(await errorOf(await join('​')), [400, 'invalid-name']);
  assert.deepEqual(await errorOf(await join(42)), [400, 'invalid-request']);
  assert.deepEqual(await errorOf(await join('ANN')), [409, 'name-taken']);
  assert.deepEqual(await errorOf(await join('Cid', 'ZZZZZZ')), [404, 'lobby-not-found']);
  assert.deepEqual(await errorOf(await join('Cid', 'not-a-code')), [404, 'lobby-not-found']);
  await join('Ben');
  await join('Cid');
  assert.deepEqual(await errorOf(await join('Dee')), [409, 'lobby-full']);
  const other = await createLobby(server, 'Eve', fromNewAddress());
  const seat = server.registry.seatOf(other.sessionToken) ?? assert.fail();
  server.registry.lock(seat, true);
  assert.deepEqual(await errorOf(await join('Fay', other.code)), [409, 'lobby-locked']);
});

test('refuses bodies that are too large or not JSON', async () => {
  const headers = fromNewAddress();
  const large = { name: 'x'.repeat(API_LIMITS.bodyBytes) };
  assert.deepEqual(await errorOf(await server.post('/api/lobbies', large, headers)), [413, 'too-large']);
  assert.deepEqual(await errorOf(await server.post('/api/lobbies', '{"name":', headers)), [400, 'invalid-request']);
});

test('throttles an address that guesses lobby codes', async () => {
  const headers = fromNewAddress();
  const { code } = await createLobby(server, 'Ann', fromNewAddress());
  for (let guess = 0; guess < API_LIMITS.unknownCodesPerMinute; guess++) {
    const response = await server.post(`/api/lobbies/ZZZZZ${'ABCDEFGHJK'[guess]}/players`, { name: 'Guess' }, headers);
    assert.equal(response.status, 404);
  }
  const blocked = await server.post(`/api/lobbies/${code}/players`, { name: 'Ben' }, headers);
  assert.deepEqual(await errorOf(blocked), [429, 'rate-limited']);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const elsewhere = await server.post(`/api/lobbies/${code}/players`, { name: 'Ben' }, fromNewAddress());
  assert.equal(elsewhere.status, 201, 'another address still joins');
});

// The open lobbies' cap per address (OPEN_LOBBIES_PER_IP) is above the creations a minute; registry.test covers it.
test('caps the creations of one address', async () => {
  const headers = fromNewAddress();
  const create = () => server.post('/api/lobbies', { name: 'Ann' }, headers);
  for (let lobby = 0; lobby < API_LIMITS.creationsPerMinute; lobby++) assert.equal((await create()).status, 201);
  assert.deepEqual(
    await errorOf(await create()),
    [429, 'rate-limited'],
    `only ${API_LIMITS.creationsPerMinute} tries a minute`,
  );
});

test('reports ready once the catalog is loaded, and sends security headers on every response', async () => {
  const ready = await fetch(`${server.baseUrl}/readyz`);
  assert.deepEqual([ready.status, await ready.json()], [200, { status: 'ready' }]);
  for (const path of ['/healthz', '/readyz', '/no-such-page']) {
    const response = await fetch(`${server.baseUrl}${path}`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value, `${path} ${name}`);
  }
});

test('answers 503 until the catalog is loaded', async () => {
  const log = createLogger('error', () => {});
  const clientDir = join(tmpdir(), 'ysto-no-client');
  const app = createApp({ clientDir, coversDir: clientDir, registry: null, ready: false, trustedProxyHops: 0, log });
  const notReady = app.listen(0, '127.0.0.1');
  await once(notReady, 'listening');
  // A server listening on a TCP port always reports an AddressInfo, never a pipe name.
  const { port } = notReady.address() as AddressInfo;
  try {
    const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
    assert.deepEqual([ready.status, await ready.json()], [503, { status: 'not-ready' }]);
    const create = await fetch(`http://127.0.0.1:${port}/api/lobbies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ann' }),
    });
    assert.deepEqual(await errorOf(create), [503, 'not-ready']);
  } finally {
    notReady.close();
  }
});
