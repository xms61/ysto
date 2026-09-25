import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  importDump,
  loadAnimeThemes,
  PAGE_SIZE,
  pageUrl,
  parseAnime,
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

function page(firstId: number, count: number): Response {
  return jsonResponse({ anime: Array.from({ length: count }, (_, index) => rawAnime(firstId + index)) });
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

test('asks for every include the catalog needs, one page at a time', () => {
  const url = new URL(pageUrl(3));
  assert.equal(url.searchParams.get('page[number]'), '3');
  assert.equal(url.searchParams.get('page[size]'), String(PAGE_SIZE));
  assert.deepEqual(url.searchParams.get('include')?.split(','), [
    'animethemes.song.artists',
    'animethemes.animethemeentries.videos',
    'resources',
    'series',
    'animesynonyms',
    'images',
  ]);
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
  assert.equal(new URL(resumed.requests[0]?.url ?? '').searchParams.get('page[number]'), '2');
});

test('refuses a page without an anime list instead of ending the sync early', async () => {
  const http = fakeHttp([jsonResponse({ message: 'maintenance' })]);
  await assert.rejects(syncAnimeThemes(syncOptions(tempDir(), http)), /has no "anime" list/);
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
