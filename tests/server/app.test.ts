import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createApp } from '../../server/app.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function clientDirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-client-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

async function withServer(clientDir: string, run: (baseUrl: string) => Promise<void>) {
  const server = createApp({ clientDir }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  // A server listening on a TCP port always reports an AddressInfo, never a pipe name.
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('answers the health check', async () => {
  await withServer(clientDirWith({}), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('serves the client build, and index.html for client-side routes', async () => {
  const clientDir = clientDirWith({ 'index.html': '<title>app</title>', 'app.js': 'export {};' });
  await withServer(clientDir, async (baseUrl) => {
    const asset = await fetch(`${baseUrl}/app.js`);
    const joinLink = await fetch(`${baseUrl}/j/ABC234`);
    assert.equal(await asset.text(), 'export {};');
    assert.equal(joinLink.status, 200);
    assert.equal(await joinLink.text(), '<title>app</title>');
  });
});

test('serves no client routes without a client build', async () => {
  await withServer(clientDirWith({}), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/j/ABC234`);
    assert.equal(response.status, 404);
  });
});

test('does not announce the framework', async () => {
  await withServer(clientDirWith({}), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});
