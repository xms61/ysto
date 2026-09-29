import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../../server/app.ts';
import { ClipTokens } from '../../server/clips/tokens.ts';
import { createLogger } from '../../server/log.ts';
import { newToken } from '../../server/tokens.ts';

const AUDIO = Buffer.from('clip bytes');
const sessionA = newToken();
const sessionB = newToken();
const sessions = new Map([
  [sessionA, 'lobby-a'],
  [sessionB, 'lobby-b'],
]);

interface ClipServer {
  token: string;
  clock: { now: number };
  get: (clipToken: string, authorization?: string) => Promise<Response>;
}

// A server whose only clip belongs to lobby-a and expires at 1000 on the fake clock.
async function withClipServer(run: (server: ClipServer) => Promise<void>) {
  const clock = { now: 0 };
  const tokens = new ClipTokens(() => clock.now);
  const token = tokens.issue('lobby-a', AUDIO, 1000);
  // The folder holds no client build, so only the API routes answer.
  const clientDir = join(tmpdir(), 'ysto-no-client');
  const clips = { tokens, lobbyOfSession: (session: string) => sessions.get(session) };
  const app = createApp({
    clientDir,
    registry: null,
    trustedProxyHops: 0,
    log: createLogger('error', () => {}),
    clips,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  // A server listening on a TCP port always reports an AddressInfo, never a pipe name.
  const { port } = server.address() as AddressInfo;
  const get = (clipToken: string, authorization?: string) =>
    fetch(`http://127.0.0.1:${port}/api/clips/${clipToken}`, authorization ? { headers: { authorization } } : {});
  try {
    await run({ token, clock, get });
  } finally {
    server.close();
  }
}

test('serves the clip to a player of its lobby, uncached and without a filename', async () => {
  await withClipServer(async ({ token, get }) => {
    const response = await get(token, `Bearer ${sessionA}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-disposition'), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), AUDIO);
  });
});

test('answers every refused request with the same uncached 404', async () => {
  await withClipServer(async ({ token, clock, get }) => {
    const refused: [string, string, string | undefined][] = [
      ['unknown token', newToken(), `Bearer ${sessionA}`],
      ['malformed token', 'abc', `Bearer ${sessionA}`],
      ['player of another lobby', token, `Bearer ${sessionB}`],
      ['unknown session', token, `Bearer ${newToken()}`],
      ['malformed session', token, 'Bearer abc'],
      ['other scheme', token, `Basic ${sessionA}`],
      ['no session', token, undefined],
    ];
    for (const [name, clipToken, authorization] of refused) {
      const response = await get(clipToken, authorization);
      assert.equal(response.status, 404, name);
      assert.equal(response.headers.get('cache-control'), 'no-store', name);
    }
    clock.now = 1000;
    assert.equal((await get(token, `Bearer ${sessionA}`)).status, 404, 'expired token');
  });
});
