import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  importDump,
  loadAnimeThemes,
  PAGE_SIZE,
  pageRequest,
  parseAnime,
  recordOfGraphqlAnime,
  syncAnimeThemes,
} from '../../scripts/catalog/animethemes.ts';
import { fakeHttp, jsonResponse } from './fixtures.ts';

const NOW = new Date('2026-09-25T12:00:00Z');
const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-animethemes-'));
  dirs.push(dir);
  return dir;
}

function rawAnime(id: number): Record<string, unknown> {
  return { id, name: `Anime ${id}`, slug: `anime_${id}`, resources: [{ site: 'AniList', external_id: 5000 + id }] };
}

function graphqlAnime(id: number): Record<string, unknown> {
  return {
    id,
    title: { romaji: `Anime ${id}` },
    slug: `anime_${id}`,
    resources: { nodes: [{ siteLocalized: 'AniList', externalId: 5000 + id }] },
  };
}

function page(firstId: number, count: number): Response {
  const anime = Array.from({ length: count }, (_, index) => graphqlAnime(firstId + index));
  return jsonResponse({ data: { animePagination: { data: anime } } });
}

function requestedPage(http: ReturnType<typeof fakeHttp>, at: number): unknown {
  const body: unknown = JSON.parse(String(http.requests[at]?.init.body));
  return typeof body === 'object' && body !== null && 'variables' in body ? body.variables : null;
}

function syncOptions(cacheDir: string, http: ReturnType<typeof fakeHttp>) {
  return { cacheDir, http, now: () => NOW, log: () => {} };
}

test('parses the fields the catalog uses', () => {
  const parsed = parseAnime({
    id: 352,
    name: 'Boruto: Naruto Next Generations',
    slug: 'boruto',
    year: 2017,
    season: 'Spring',
    media_format: 'TV',
    resources: [
      { site: 'MyAnimeList', external_id: 34566 },
      { site: 'AniList', external_id: 97938 },
    ],
    series: [{ id: 7, name: 'Naruto' }],
    animesynonyms: [{ text: 'Boruto' }, { text: null }],
    images: [
      { facet: 'Small Cover', link: 'https://img.example.test/small.jpg' },
      { facet: 'Large Cover', link: 'https://img.example.test/large.jpg' },
    ],
    animethemes: [
      {
        id: 7642,
        type: 'OP',
        sequence: null,
        slug: 'OP',
        song: { id: 7643, title: 'Baton Road', artists: [{ id: 102, name: 'KANA-BOON', artistsong: { as: null } }] },
        animethemeentries: [
          { version: 1, videos: [{ basename: 'Boruto-OP1.webm' }] },
          { version: 2, videos: [{ basename: 'Boruto-OP1v2.webm' }] },
        ],
      },
      { id: 1, type: 'IN', sequence: 1, slug: 'IN1' },
    ],
  });
  assert.deepEqual(parsed, {
    id: 352,
    name: 'Boruto: Naruto Next Generations',
    slug: 'boruto',
    year: 2017,
    season: 'Spring',
    mediaFormat: 'TV',
    anilistId: 97938,
    malId: 34566,
    series: [{ id: 7, name: 'Naruto' }],
    synonyms: ['Boruto'],
    coverUrl: 'https://img.example.test/large.jpg',
    themes: [
      {
        id: 7642,
        kind: 'OP',
        sequence: 1,
        slug: 'OP',
        song: { id: 7643, title: 'Baton Road', artists: [{ id: 102, name: 'KANA-BOON', creditedAs: null }] },
        videos: [
          { basename: 'Boruto-OP1.webm', entryVersion: 1 },
          { basename: 'Boruto-OP1v2.webm', entryVersion: 2 },
        ],
      },
    ],
  });
});

test('falls back to the small cover, and has no cover without images', () => {
  const base = { id: 1, name: 'Show', slug: 'show' };
  const small = [{ facet: 'Small Cover', link: 'https://img.example.test/small.jpg' }, { facet: 'Grill' }];
  assert.equal(parseAnime({ ...base, images: small })?.coverUrl, 'https://img.example.test/small.jpg');
  assert.equal(parseAnime(base)?.coverUrl, null);
});

test('drops anime without an id, a name or a slug', () => {
  assert.equal(parseAnime({ name: 'No id', slug: 'x' }), null);
  assert.equal(parseAnime({ id: 1, slug: 'x' }), null);
  assert.equal(parseAnime({ id: 1, name: 'No slug' }), null);
});

test('asks for one page of every field the catalog uses', () => {
  const request = pageRequest(3);
  assert.deepEqual(request.variables, { page: 3, size: PAGE_SIZE });
  for (const field of ['seasonLocalized', 'formatLocalized', 'performances', 'animethemeentries', 'facetLocalized']) {
    assert.match(request.query, new RegExp(field));
  }
});

test('reads a GraphQL anime as the record a dump holds', () => {
  const record = recordOfGraphqlAnime({
    id: 352,
    title: { romaji: 'Boruto: Naruto Next Generations' },
    slug: 'boruto',
    year: 2017,
    seasonLocalized: 'Spring',
    formatLocalized: 'TV',
    synonyms: [{ text: 'Boruto' }],
    series: { nodes: [{ id: 7, name: 'Naruto' }] },
    resources: { nodes: [{ siteLocalized: 'AniList', externalId: 97938 }] },
    images: { nodes: [{ facetLocalized: 'Large Cover', link: 'https://img.example.test/large.jpg' }] },
    animethemes: [
      {
        id: 7642,
        type: 'OP',
        sequence: 1,
        slug: 'OP1',
        song: {
          id: 7643,
          title: { romaji: 'Baton Road' },
          performances: [
            { as: 'KB', artist: { id: 102, name: { main: 'KANA-BOON' } } },
            { as: null, artist: { id: 102, name: { main: 'KANA-BOON' } } },
            { as: null, artist: null },
          ],
        },
        animethemeentries: [{ version: 2, videos: { nodes: [{ basename: 'Boruto-OP1v2.webm' }] } }],
      },
    ],
  });
  assert.deepEqual(parseAnime(record), {
    id: 352,
    name: 'Boruto: Naruto Next Generations',
    slug: 'boruto',
    year: 2017,
    season: 'Spring',
    mediaFormat: 'TV',
    anilistId: 97938,
    malId: null,
    series: [{ id: 7, name: 'Naruto' }],
    synonyms: ['Boruto'],
    coverUrl: 'https://img.example.test/large.jpg',
    themes: [
      {
        id: 7642,
        kind: 'OP',
        sequence: 1,
        slug: 'OP1',
        song: { id: 7643, title: 'Baton Road', artists: [{ id: 102, name: 'KANA-BOON', creditedAs: 'KB' }] },
        videos: [{ basename: 'Boruto-OP1v2.webm', entryVersion: 2 }],
      },
    ],
  });
});

test('syncs pages until a short one, then marks the cache complete', async () => {
  const cacheDir = tempDir();
  const http = fakeHttp([page(1, PAGE_SIZE), page(101, 3)]);
  assert.equal(await syncAnimeThemes(syncOptions(cacheDir, http)), PAGE_SIZE + 3);
  assert.equal(http.requests.length, 2);
  assert.deepEqual(http.sleeps, [1000, 1000]);
  const loaded = loadAnimeThemes(cacheDir);
  assert.equal(loaded.anime.length, PAGE_SIZE + 3);
  assert.equal(loaded.source, 'api');
  assert.equal(loaded.completedAt, NOW.toISOString());
});

test('resumes an interrupted sync from the pages already cached', async () => {
  const cacheDir = tempDir();
  const failing = fakeHttp([page(1, PAGE_SIZE), ...Array.from({ length: 5 }, () => jsonResponse({}, 503))]);
  await assert.rejects(syncAnimeThemes(syncOptions(cacheDir, failing)));
  assert.throws(() => loadAnimeThemes(cacheDir), /No complete AnimeThemes cache/);
  const resumed = fakeHttp([page(101, 2)]);
  assert.equal(await syncAnimeThemes(syncOptions(cacheDir, resumed)), PAGE_SIZE + 2);
  assert.equal(resumed.requests.length, 1);
  assert.deepEqual(requestedPage(resumed, 0), { page: 2, size: PAGE_SIZE });
});

test('refuses a page without an anime list instead of ending the sync early', async () => {
  const http = fakeHttp([jsonResponse({ message: 'maintenance' })]);
  await assert.rejects(syncAnimeThemes(syncOptions(tempDir(), http)), /has no "anime" list/);
});

test('stops on a GraphQL error and says what it was', async () => {
  const http = fakeHttp([jsonResponse({ errors: [{ message: 'Query complexity too high' }] })]);
  await assert.rejects(syncAnimeThemes(syncOptions(tempDir(), http)), /Query complexity too high/);
});

test('imports a dump in place of a sync', () => {
  const cacheDir = tempDir();
  const dumpFile = join(tempDir(), 'dump.json');
  writeFileSync(dumpFile, JSON.stringify([rawAnime(1), rawAnime(2), 'not an anime']));
  assert.equal(importDump({ dumpFile, cacheDir, now: () => NOW }), 3);
  const loaded = loadAnimeThemes(cacheDir);
  assert.deepEqual(
    loaded.anime.map((entry) => entry.anilistId),
    [5001, 5002],
  );
  assert.equal(loaded.source, 'dump');
});

test('refuses a dump that is not a list of anime', () => {
  const dumpFile = join(tempDir(), 'dump.json');
  writeFileSync(dumpFile, JSON.stringify({ anime: [] }));
  const cacheDir = tempDir();
  assert.throws(() => importDump({ dumpFile, cacheDir, now: () => NOW }), /not a JSON array/);
  assert.equal(existsSync(join(cacheDir, 'animethemes')), false);
});
