import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { MAX_LOBBY_AGE_MS } from '../../server/game/lobby.ts';
import { REALTIME_LIMITS } from '../../server/realtime/hub.ts';
import { newToken } from '../../server/tokens.ts';
import { CLOSE_CODES } from '../../shared/protocol.ts';
import { createLobby, joinLobby, startServer, TestClient } from '../server/harness.ts';
import type { TestServer } from '../server/harness.ts';

const { version: packageVersion } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

async function withServer(run: (server: TestServer) => Promise<void>, options = {}): Promise<void> {
  const server = await startServer(options);
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

// The status an upgrade was refused with, from a client that sends the given origin and headers.
async function refusedUpgrade(url: string, origin: string | undefined, headers: Record<string, string> = {}) {
  const socket = new WebSocket(url, { ...(origin !== undefined && { origin }), headers });
  // Destroying the refused request makes ws report an aborted handshake, which is expected here.
  socket.on('error', () => {});
  // ws emits the client request and the server's response for a refused upgrade.
  const [request, response] = (await once(socket, 'unexpected-response')) as [ClientRequest, IncomingMessage];
  request.destroy();
  return response.statusCode;
}

test('seats players with hello and sends each of them the lobby state', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.open(server);
    annClient.send({ type: 'hello', sessionToken: ann.sessionToken });
    const first = await annClient.state();
    assert.equal(first.code, ann.code);
    assert.equal(first.version, packageVersion, "the server's build, for stale pages to reload");
    assert.equal(first.you, ann.playerId);
    assert.equal(first.hostId, ann.playerId);
    assert.deepEqual(first.players, [{ id: ann.playerId, name: 'Ann', connected: true, spectating: false, score: 0 }]);
    assert.equal(first.game, null);
    assert.ok(first.pool.anime > 0 && first.bounds.genres.length > 0);
    const ben = await joinLobby(server, ann.code, 'Ben');
    await annClient.state((state) => state.players.some((player) => player.id === ben.playerId && !player.connected));
    const benClient = await TestClient.open(server);
    benClient.send({ type: 'hello', sessionToken: ben.sessionToken });
    const benView = await benClient.state();
    assert.equal(benView.you, ben.playerId);
    assert.deepEqual(
      benView.players.map((player) => [player.name, player.connected]),
      [
        ['Ann', true],
        ['Ben', true],
      ],
    );
    await annClient.state((state) => state.players.length === 2 && state.players.every((player) => player.connected));
  });
});

test('hands the host to the player connected longest when the host leaves', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.seated(server, ann);
    const ben = await joinLobby(server, ann.code, 'Ben');
    const benClient = await TestClient.seated(server, ben);
    const cid = await joinLobby(server, ann.code, 'Cid');
    await TestClient.seated(server, cid);
    annClient.send({ type: 'lobby:leave' });
    assert.equal((await annClient.closed).code, CLOSE_CODES.left);
    const state = await benClient.state((candidate) => candidate.players.length === 2);
    assert.equal(state.hostId, ben.playerId);
    assert.equal(server.registry.seatOf(ann.sessionToken), undefined, 'a player who left has no session');
  });
});

test('kicks a player, who cannot come back with the same session', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.seated(server, ann);
    const ben = await joinLobby(server, ann.code, 'Ben');
    const benClient = await TestClient.seated(server, ben);
    benClient.send({ type: 'player:kick', playerId: ann.playerId });
    assert.deepEqual(await benClient.next((message) => message.type === 'error'), { type: 'error', code: 'not-host' });
    annClient.send({ type: 'player:kick', playerId: ben.playerId });
    assert.equal((await benClient.closed).code, CLOSE_CODES.kicked);
    await annClient.state((state) => state.players.length === 1);
    const again = await TestClient.open(server);
    again.send({ type: 'hello', sessionToken: ben.sessionToken });
    assert.equal((await again.closed).code, CLOSE_CODES.unknownSession);
  });
});

test('puts a player who reconnects back in their seat, and replaces an older socket of the same seat', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.seated(server, ann);
    const ben = await joinLobby(server, ann.code, 'Ben');
    const benClient = await TestClient.seated(server, ben);
    benClient.socket.close();
    await annClient.state((state) => state.players.some((player) => player.id === ben.playerId && !player.connected));
    const reloaded = await TestClient.seated(server, ben);
    const state = await annClient.state((candidate) => candidate.players.every((player) => player.connected));
    assert.deepEqual(
      state.players.map((player) => player.id),
      [ann.playerId, ben.playerId],
    );
    const secondTab = await TestClient.seated(server, ben);
    assert.equal((await reloaded.closed).code, CLOSE_CODES.replaced);
    secondTab.send({ type: 'time:ping', clientTime: 42 });
    const pong = await secondTab.next((message) => message.type === 'time:pong');
    assert.ok(pong.type === 'time:pong' && pong.clientTime === 42 && pong.serverTime > 0);
  });
});

test('shares the host settings and the lock with everyone', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.seated(server, ann);
    const ben = await joinLobby(server, ann.code, 'Ben');
    const benClient = await TestClient.seated(server, ben);
    const { settings } = server.registry.lobby(ann.code) ?? assert.fail();
    benClient.send({ type: 'lobby:lock', locked: true });
    assert.deepEqual(await benClient.next((message) => message.type === 'error'), { type: 'error', code: 'not-host' });
    annClient.send({ type: 'settings:update', settings: { ...settings, songsPerGame: 5, difficulty: 'easy' } });
    const updated = await benClient.state((state) => state.settings.songsPerGame === 5);
    assert.equal(updated.settings.difficulty, 'easy');
    annClient.send({ type: 'lobby:lock', locked: true });
    await benClient.state((state) => state.locked);
  });
});

test('closes the sockets of a lobby that expires', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const annClient = await TestClient.seated(server, ann);
    server.scheduler.time += MAX_LOBBY_AGE_MS;
    server.registry.sweep();
    assert.equal((await annClient.closed).code, CLOSE_CODES.lobbyClosed);
  });
});

test('tells players when the server is closing', async () => {
  const server = await startServer();
  const ann = await createLobby(server, 'Ann');
  const annClient = await TestClient.seated(server, ann);
  const closing = server.close();
  assert.deepEqual(await annClient.next((message) => message.type === 'server:closing'), { type: 'server:closing' });
  assert.equal((await annClient.closed).code, CLOSE_CODES.serverClosing);
  await closing;
});

test('refuses upgrades from other origins, on other paths, or past the per-IP cap', async () => {
  await withServer(
    async (server) => {
      assert.equal(await refusedUpgrade(server.wsUrl, 'https://evil.example'), 403);
      assert.equal(await refusedUpgrade(server.wsUrl, undefined), 403);
      assert.equal(await refusedUpgrade(server.wsUrl.replace('/ws', '/other'), server.origin), 404);
      const allowed = new TestClient(server.wsUrl, { origin: 'http://localhost:5173' });
      await once(allowed.socket, 'open');
      const headers = { 'x-forwarded-for': '203.0.113.50' };
      const clients = await Promise.all(
        Array.from({ length: REALTIME_LIMITS.connectionsPerIp }, () => TestClient.open(server, headers)),
      );
      assert.equal(await refusedUpgrade(server.wsUrl, server.origin, headers), 429);
      await TestClient.open(server, { 'x-forwarded-for': '203.0.113.51' });
      for (const client of clients) client.socket.close();
    },
    { trustedProxyHops: 1, allowedOrigins: ['http://localhost:5173'] },
  );
});

test('closes a socket that sends an oversized frame', async () => {
  await withServer(async (server) => {
    const client = await TestClient.open(server);
    client.send({ type: 'hello', sessionToken: 'x'.repeat(REALTIME_LIMITS.maxPayloadBytes) });
    assert.equal((await client.closed).code, CLOSE_CODES.tooLarge);
  });
});

test('answers invalid messages with errors, then closes the socket', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const client = await TestClient.seated(server, ann);
    for (let strike = 1; strike < REALTIME_LIMITS.strikes; strike++) {
      client.send('not json');
      assert.deepEqual(await client.next((message) => message.type === 'error'), {
        type: 'error',
        code: 'invalid-message',
      });
    }
    client.send({ type: 'lobby:delete' });
    assert.equal((await client.closed).code, CLOSE_CODES.invalidMessages);
  });
});

test('closes a socket that sends anything before hello, or an unknown session', async () => {
  await withServer(async (server) => {
    const early = await TestClient.open(server);
    early.send({ type: 'time:ping', clientTime: 1 });
    assert.equal((await early.closed).code, CLOSE_CODES.invalidMessages);
    const stranger = await TestClient.open(server);
    stranger.send({ type: 'hello', sessionToken: newToken() });
    assert.equal((await stranger.closed).code, CLOSE_CODES.unknownSession);
  });
});

test('limits each socket to 20 messages a second', async () => {
  await withServer(async (server) => {
    const ann = await createLobby(server, 'Ann');
    const client = await TestClient.seated(server, ann);
    const burst = REALTIME_LIMITS.messagesPerSecond + REALTIME_LIMITS.strikes;
    for (let message = 0; message < burst; message++) client.send({ type: 'time:ping', clientTime: message });
    assert.equal((await client.closed).code, CLOSE_CODES.invalidMessages);
  });
});
