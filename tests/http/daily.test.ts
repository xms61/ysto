import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHmac } from 'node:crypto';
import { dailyQuestions, dailySeed } from '../../server/game/daily.ts';
import { DAILY_MODES, dailyNumber, dailySettings } from '../../shared/daily.ts';
import type { DailyMode } from '../../shared/daily.ts';
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

const catalog = syntheticCatalog();
function songs(secret: string, number: number, mode: DailyMode = 'both'): string[] {
  const settings = dailySettings(settingsBounds(catalog), mode);
  return dailyQuestions(catalog, settings, secret, { number, mode }).map(
    (question) => `${question.themeId}@${question.clip.startMs}`,
  );
}

test("gives everyone the same ten songs a day, another ten the next day, and a secret's own", () => {
  for (const mode of DAILY_MODES) {
    assert.equal(songs(SECRET, 5, mode).length, 10);
    assert.deepEqual(songs(SECRET, 5, mode), songs(SECRET, 5, mode));
    assert.notDeepEqual(songs(SECRET, 5, mode), songs(SECRET, 6, mode));
    assert.notDeepEqual(songs(SECRET, 5, mode), songs('b'.repeat(32), 5, mode));
  }
});

test('draws each daily of a day apart, openings and endings only of their kind', () => {
  const kindOf = (themeId: number) => catalog.themes.find((theme) => theme.id === themeId)?.kind;
  const kinds = (mode: DailyMode) => {
    const settings = dailySettings(settingsBounds(catalog), mode);
    return new Set(dailyQuestions(catalog, settings, SECRET, { number: 5, mode }).map((q) => kindOf(q.themeId)));
  };
  assert.deepEqual(kinds('openings'), new Set(['OP']));
  assert.deepEqual(kinds('endings'), new Set(['ED']));
  assert.notDeepEqual(songs(SECRET, 5, 'openings'), songs(SECRET, 5, 'both'));
  assert.notDeepEqual(songs(SECRET, 5, 'endings'), songs(SECRET, 5, 'both'));
});

test('keeps the seed Both had as the only daily, so its songs stay the same', () => {
  const before = createHmac('sha256', SECRET).update('daily:5').digest().readUInt32BE(0);
  assert.equal(dailySeed(SECRET, { number: 5, mode: 'both' }), before);
  assert.notEqual(dailySeed(SECRET, { number: 5, mode: 'openings' }), before);
});

test("tells the home screen whether today's dailies are on, and the day's number", async () => {
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
  assert.deepEqual(lobby?.daily, { number: dailyNumber(Date.now()), mode: 'both' });
  assert.deepEqual(lobby?.settings, dailySettings(on.registry.bounds, 'both'));
  const join = await on.post(`/api/lobbies/${code}/players`, { name: 'Ben' }, fromNewAddress());
  assert.equal(join.status, 409);
});

test('refuses a daily when the server has no secret', async () => {
  const response = await off.post('/api/daily', { name: 'Ann' }, fromNewAddress());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'daily-off' });
});

test('opens the openings and endings dailies with their own settings', async () => {
  for (const mode of ['openings', 'endings'] as const) {
    const response = await on.post('/api/daily', { name: 'Ann', mode }, fromNewAddress());
    assert.equal(response.status, 201);
    const { code } = (await response.json()) as { code: string };
    const lobby = on.registry.lobby(code);
    assert.deepEqual(lobby?.daily, { number: dailyNumber(Date.now()), mode });
    assert.deepEqual(lobby?.settings, dailySettings(on.registry.bounds, mode));
  }
});

test('refuses a daily that is not one of the three', async () => {
  const response = await on.post('/api/daily', { name: 'Ann', mode: 'inserts' }, fromNewAddress());
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid-request' });
  const extra = await on.post('/api/daily', { name: 'Ann', mode: 'both', extra: 1 }, fromNewAddress());
  assert.equal(extra.status, 400);
});
