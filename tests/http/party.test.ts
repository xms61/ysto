import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createLobby, startServer } from '../server/harness.ts';
import type { TestServer } from '../server/harness.ts';

let server: TestServer;
before(async () => {
  server = await startServer({ trustedProxyHops: 1 });
});
after(() => server.close());

let nextAddress = 1;
function fromNewAddress(): Record<string, string> {
  return { 'x-forwarded-for': `192.0.2.${nextAddress++}` };
}

test('seats a screen by the lobby code, up to two', async () => {
  const { code } = await createLobby(server, 'Ann', fromNewAddress());
  for (const name of ['Screen', 'Screen 2']) {
    const response = await server.post(`/api/lobbies/${code}/screens`, {}, fromNewAddress());
    assert.equal(response.status, 201);
    const { playerId } = (await response.json()) as { playerId: string };
    assert.equal(server.registry.lobby(code)?.players.find((player) => player.id === playerId)?.name, name);
  }
  const third = await server.post(`/api/lobbies/${code}/screens`, {}, fromNewAddress());
  assert.equal(third.status, 409);
  assert.deepEqual(await third.json(), { error: 'screens-full' });
});

test("won't start a party game without a connected screen", async () => {
  const { code, playerId } = await createLobby(server, 'Ann', fromNewAddress());
  const seat = { code, playerId };
  const lobby = server.registry.lobby(code);
  assert.ok(lobby);
  assert.equal(server.registry.updateSettings(seat, { ...lobby.settings, party: true }), null);
  assert.equal(server.games.start(seat), 'no-screen');
});
