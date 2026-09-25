// AnimeThemes metadata: pages from api.animethemes.moe or an existing dump, cached raw under
// <cacheDir>/animethemes/, and parsed into the fields the catalog uses. A complete.json marker is
// written last, so a build never starts from a half-finished sync.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPresent, isRecord, numberOrNull, recordsIn, stringOrNull, stringsIn } from './fields.ts';
import type { JsonRecord } from './fields.ts';
import { getJson } from './http.ts';
import type { HttpClient } from './http.ts';
import { readJsonFile, writeJsonFile } from './json-files.ts';

export interface AtArtist {
  id: number;
  name: string;
  creditedAs: string | null;
}

export interface AtSong {
  id: number;
  title: string | null;
  artists: AtArtist[];
}

export interface AtVideo {
  basename: string;
  entryVersion: number;
}

export interface AtTheme {
  id: number;
  kind: 'OP' | 'ED';
  sequence: number;
  slug: string;
  song: AtSong | null;
  videos: AtVideo[];
}

export interface AtAnime {
  id: number;
  name: string;
  slug: string;
  year: number | null;
  season: string | null;
  mediaFormat: string | null;
  anilistId: number | null;
  malId: number | null;
  series: { id: number; name: string }[];
  synonyms: string[];
  coverUrl: string | null;
  themes: AtTheme[];
}

export interface AnimeThemesData {
  anime: AtAnime[];
  source: string;
  completedAt: string;
}

interface SyncOptions {
  cacheDir: string;
  http: HttpClient;
  now: () => Date;
  log: (line: string) => void;
}

const API_URL = 'https://api.animethemes.moe/anime';
const INCLUDES = [
  'animethemes.song.artists',
  'animethemes.animethemeentries.videos',
  'resources',
  'series',
  'animesynonyms',
  'images',
].join(',');
// Reveals show the large cover; the small one stands in when an anime has no large one.
const COVER_FACETS = ['Large Cover', 'Small Cover'];
export const PAGE_SIZE = 100;
// One request a second stays well under AnimeThemes' limit of 90 a minute.
const REQUEST_INTERVAL_MS = 1000;
const COMPLETE_FILE = 'complete.json';

function cacheDirOf(cacheDir: string): string {
  return join(cacheDir, 'animethemes');
}

function pageFile(dir: string, page: number): string {
  return join(dir, `page-${String(page).padStart(4, '0')}.json`);
}

export function pageUrl(page: number): string {
  const params = new URLSearchParams({
    include: INCLUDES,
    'page[size]': String(PAGE_SIZE),
    'page[number]': String(page),
  });
  return `${API_URL}?${params}`;
}

function rawAnimeIn(body: unknown, where: string): JsonRecord[] {
  if (!isRecord(body) || !Array.isArray(body.anime)) throw new Error(`${where} has no "anime" list`);
  return recordsIn(body.anime);
}

function parseArtist(raw: JsonRecord): AtArtist | null {
  const id = numberOrNull(raw.id);
  const name = stringOrNull(raw.name);
  if (id === null || name === null) return null;
  return { id, name, creditedAs: isRecord(raw.artistsong) ? stringOrNull(raw.artistsong.as) : null };
}

function parseSong(raw: unknown): AtSong | null {
  if (!isRecord(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  return { id, title: stringOrNull(raw.title), artists: recordsIn(raw.artists).map(parseArtist).filter(isPresent) };
}

function parseVideos(rawEntries: unknown): AtVideo[] {
  return recordsIn(rawEntries).flatMap((entry) => {
    const entryVersion = numberOrNull(entry.version) ?? 1;
    return recordsIn(entry.videos)
      .map((video) => stringOrNull(video.basename))
      .filter(isPresent)
      .map((basename) => ({ basename, entryVersion }));
  });
}

function parseTheme(raw: JsonRecord): AtTheme | null {
  const id = numberOrNull(raw.id);
  const kind = raw.type;
  if (id === null || (kind !== 'OP' && kind !== 'ED')) return null;
  const sequence = numberOrNull(raw.sequence) ?? 1;
  return {
    id,
    kind,
    sequence,
    slug: stringOrNull(raw.slug) ?? `${kind}${sequence}`,
    song: parseSong(raw.song),
    videos: parseVideos(raw.animethemeentries),
  };
}

function externalId(resources: JsonRecord[], site: string): number | null {
  return numberOrNull(resources.find((resource) => resource.site === site)?.external_id);
}

function coverUrl(images: JsonRecord[]): string | null {
  for (const facet of COVER_FACETS) {
    const link = stringOrNull(images.find((image) => image.facet === facet)?.link);
    if (link !== null) return link;
  }
  return null;
}

export function parseAnime(raw: JsonRecord): AtAnime | null {
  const id = numberOrNull(raw.id);
  const name = stringOrNull(raw.name);
  const slug = stringOrNull(raw.slug);
  if (id === null || name === null || slug === null) return null;
  const resources = recordsIn(raw.resources);
  const series = recordsIn(raw.series).flatMap((entry) => {
    const seriesId = numberOrNull(entry.id);
    const seriesName = stringOrNull(entry.name);
    return seriesId === null || seriesName === null ? [] : [{ id: seriesId, name: seriesName }];
  });
  return {
    id,
    name,
    slug,
    year: numberOrNull(raw.year),
    season: stringOrNull(raw.season),
    mediaFormat: stringOrNull(raw.media_format),
    anilistId: externalId(resources, 'AniList'),
    malId: externalId(resources, 'MyAnimeList'),
    series,
    synonyms: stringsIn(recordsIn(raw.animesynonyms).map((synonym) => stringOrNull(synonym.text))),
    coverUrl: coverUrl(recordsIn(raw.images)),
    themes: recordsIn(raw.animethemes).map(parseTheme).filter(isPresent),
  };
}

async function ensurePage(dir: string, page: number, options: SyncOptions): Promise<number> {
  const file = pageFile(dir, page);
  if (existsSync(file)) return rawAnimeIn(readJsonFile(file), file).length;
  const url = pageUrl(page);
  const anime = rawAnimeIn(await getJson(options.http, url), url);
  writeJsonFile(file, { anime });
  options.log(`page ${page}: ${anime.length} anime`);
  await options.http.sleep(REQUEST_INTERVAL_MS);
  return anime.length;
}

// Fetches pages until one comes back short. Pages already in the cache are reused, so an interrupted
// sync resumes where it stopped.
export async function syncAnimeThemes(options: SyncOptions): Promise<number> {
  const dir = cacheDirOf(options.cacheDir);
  let total = 0;
  for (let page = 1; ; page++) {
    const count = await ensurePage(dir, page, options);
    total += count;
    if (count < PAGE_SIZE) {
      writeJsonFile(join(dir, COMPLETE_FILE), { source: 'api', completedAt: options.now().toISOString(), pages: page });
      return total;
    }
  }
}

export function clearAnimeThemesCache(cacheDir: string): void {
  rmSync(cacheDirOf(cacheDir), { recursive: true, force: true });
}

// Imports a dump (a JSON array of anime in the API's shape) in place of a sync.
export function importDump(options: { dumpFile: string; cacheDir: string; now: () => Date }): number {
  const raw = readJsonFile(options.dumpFile);
  if (!Array.isArray(raw)) throw new Error('The dump is not a JSON array of AnimeThemes anime');
  const dir = cacheDirOf(options.cacheDir);
  clearAnimeThemesCache(options.cacheDir);
  writeJsonFile(pageFile(dir, 1), { anime: raw.filter(isRecord) });
  writeJsonFile(join(dir, COMPLETE_FILE), {
    source: 'dump',
    completedAt: options.now().toISOString(),
    dumpModifiedAt: statSync(options.dumpFile).mtime.toISOString(),
    pages: 1,
  });
  return raw.length;
}

export function loadAnimeThemes(cacheDir: string): AnimeThemesData {
  const dir = cacheDirOf(cacheDir);
  const completeFile = join(dir, COMPLETE_FILE);
  if (!existsSync(completeFile)) {
    throw new Error('No complete AnimeThemes cache. Run `npm run catalog:sync-animethemes` first.');
  }
  const complete = readJsonFile(completeFile);
  const pages = readdirSync(dir)
    .filter((name) => /^page-\d+\.json$/.test(name))
    .sort();
  const anime = pages
    .flatMap((name) => rawAnimeIn(readJsonFile(join(dir, name)), name))
    .map(parseAnime)
    .filter(isPresent);
  return {
    anime,
    source: isRecord(complete) ? (stringOrNull(complete.source) ?? 'unknown') : 'unknown',
    completedAt: isRecord(complete) ? (stringOrNull(complete.completedAt) ?? '') : '',
  };
}
