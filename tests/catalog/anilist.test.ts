import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { enrichFromAniList, isAdultMedia, loadAniList, parseMedia } from '../../scripts/catalog/anilist.ts';
import { fakeHttp, jsonResponse, media } from './fixtures.ts';

const NOW = new Date('2026-09-25T12:00:00Z');
const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-anilist-'));
  dirs.push(dir);
  return dir;
}

function rawMedia(id: number): Record<string, unknown> {
  return { id, isAdult: false, popularity: id * 10, genres: ['Drama'], synonyms: [], title: { romaji: `R${id}` } };
}

function pageOf(ids: number[]): Response {
  return jsonResponse({ data: { Page: { media: ids.map(rawMedia) } } });
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

test('parses titles, the cover and only the relations to other anime', () => {
  const parsed = parseMedia({
    id: 20,
    isAdult: false,
    popularity: 727970,
    genres: ['Action'],
    synonyms: ['NARUTO'],
    title: { romaji: 'NARUTO', english: 'Naruto', native: 'NARUTO -ナルト-' },
    relations: {
      edges: [
        { relationType: 'SEQUEL', node: { id: 1735, type: 'ANIME' } },
        { relationType: 'ADAPTATION', node: { id: 30011, type: 'MANGA' } },
      ],
    },
  });
  assert.deepEqual(parsed, {
    id: 20,
    isAdult: false,
    popularity: 727970,
    genres: ['Action'],
    synonyms: ['NARUTO'],
    title: { romaji: 'NARUTO', english: 'Naruto', native: 'NARUTO -ナルト-' },
    relations: [{ type: 'SEQUEL', animeId: 1735 }],
  });
});

test('counts adult media and the Hentai genre as adult', () => {
  assert.equal(isAdultMedia(media(1, { isAdult: true })), true);
  assert.equal(isAdultMedia(media(2, { genres: ['Hentai'] })), true);
  assert.equal(isAdultMedia(media(3)), false);
  assert.equal(isAdultMedia(undefined), false);
});

test('fetches unseen ids in paced batches of 50 and caches them', async () => {
  const cacheDir = tempDir();
  const http = fakeHttp([pageOf(range(1, 50)), pageOf(range(51, 100)), pageOf(range(101, 120))]);
  const result = await enrichFromAniList({ ids: range(1, 120), cacheDir, http, now: () => NOW, log: () => {} });
  assert.deepEqual(result, { fetched: 120, missing: 0 });
  const batches = http.requests.map((request) => JSON.parse(String(request.init.body)).variables.ids.length);
  assert.deepEqual(batches, [50, 50, 20]);
  assert.deepEqual(http.sleeps, [2100, 2100, 2100]);
  const loaded = loadAniList(cacheDir);
  assert.equal(loaded.media.size, 120);
  assert.equal(loaded.media.get(7)?.popularity, 70);
  assert.equal(loaded.fetchedAt, NOW.toISOString());
});

test('asks only for ids it has not seen, and remembers ids AniList does not know', async () => {
  const cacheDir = tempDir();
  const first = fakeHttp([pageOf([1, 2])]);
  assert.deepEqual(await enrichFromAniList({ ids: [1, 2, 3], cacheDir, http: first, now: () => NOW, log: () => {} }), {
    fetched: 2,
    missing: 1,
  });
  const second = fakeHttp([pageOf([4])]);
  await enrichFromAniList({ ids: [1, 2, 3, 4], cacheDir, http: second, now: () => NOW, log: () => {} });
  assert.deepEqual(JSON.parse(String(second.requests[0]?.init.body)).variables.ids, [4]);
});

test('stops on a GraphQL error', async () => {
  const http = fakeHttp([jsonResponse({ errors: [{ message: 'Invalid token' }], data: null })]);
  await assert.rejects(
    enrichFromAniList({ ids: [1], cacheDir: tempDir(), http, now: () => NOW, log: () => {} }),
    /AniList error: Invalid token/,
  );
});
