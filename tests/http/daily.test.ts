import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { dailyQuestions } from '../../server/game/daily.ts';
import { dailyNumber, dailySettings } from '../../shared/daily.ts';
import { settingsBounds } from '../../server/game/pool.ts';
import { syntheticCatalog } from '../game/fixtures.ts';
import { startServer } from '../server/harness.ts';
import type { TestServer } from '../server/harness.ts';

const SECRET = 'a'.repeat(32);
let on: TestServer;
let off: TestServer;
before(async () => {
  on = await startServer({ dailySecret: SECRET });
  off = await startServer();
});
after(async () => {
  await on.close();
  await off.close();
});

let nextAddress = 1;
function fromNewAddress(): Record<string, string> {
  return { 'x-forwarded-for': `198.51.100.${nextAddress++}` };
}

test('numbers the days from the first daily, changing at 00:00 UTC', () => {
  assert.equal(dailyNumber(Date.UTC(2026, 9, 1, 0, 0)), 1);
  assert.equal(dailyNumber(Date.UTC(2026, 9, 1, 23, 59, 59)), 1);
  assert.equal(dailyNumber(Date.UTC(2026, 9, 2, 0, 0)), 2);
  assert.equal(dailyNumber(Date.UTC(2026, 10, 1)), 32);
});

test("gives everyone the same ten songs a day, another ten the next day, and a secret's own", () => {
  const catalog = syntheticCatalog();
  const settings = dailySettings(settingsBounds(catalog));
  const songs = (secret: string, day: number) =>
    dailyQuestions(catalog, settings, secret, day).map((question) => `${question.themeId}@${question.clip.startMs}`);
  assert.equal(songs(SECRET, 5).length, 10);
  assert.deepEqual(songs(SECRET, 5), songs(SECRET, 5));
  assert.notDeepEqual(songs(SECRET, 5), songs(SECRET, 6));
  assert.notDeepEqual(songs(SECRET, 5), songs('b'.repeat(32), 5));
});

test("tells the home screen whether today's daily is on, and its number", async () => {
  const today = (await (await fetch(`${on.baseUrl}/api/daily`)).json()) as { on: boolean; number: number };
  assert.equal(today.on, true);
  assert.equal(today.number, dailyNumber(Date.now()));
  const none = (await (await fetch(`${off.baseUrl}/api/daily`)).json()) as { on: boolean };
  assert.equal(none.on, false);
});

test("opens today's daily as a locked one-player lobby with the fixed settings, and nobody can join it", async () => {
  const response = await on.post('/api/daily', { name: 'Ann' }, fromNewAddress());
  assert.equal(response.status, 201);
  const { code } = (await response.json()) as { code: string };
  const lobby = on.registry.lobby(code);
  assert.equal(lobby?.locked, true);
  assert.deepEqual(lobby?.daily, { number: dailyNumber(Date.now()) });
  assert.deepEqual(lobby?.settings, dailySettings(on.registry.bounds));
  const join = await on.post(`/api/lobbies/${code}/players`, { name: 'Ben' }, fromNewAddress());
  assert.equal(join.status, 409);
});

test('refuses a daily when the server has no secret', async () => {
  const response = await off.post('/api/daily', { name: 'Ann' }, fromNewAddress());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'daily-off' });
});
