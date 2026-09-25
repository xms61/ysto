// AniList metadata for the catalog's anime: titles, genres, popularity, the adult flag and relations,
// and nothing else, because AniList's terms prohibit hoarding its data. Fetched in batches of 50 ids,
// paced under AniList's rate limit, and cached in one file (<cacheDir>/anilist/media.json), so a
// rerun fetches only ids it hasn't seen.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isPresent, isRecord, numberOrNull, recordsIn, stringOrNull, stringsIn } from './fields.ts';
import type { JsonRecord } from './fields.ts';
import { postJson } from './http.ts';
import type { HttpClient } from './http.ts';
import { readJsonFile, writeJsonFile } from './json-files.ts';

export interface AniListMedia {
  id: number;
  isAdult: boolean;
  popularity: number | null;
  genres: string[];
  synonyms: string[];
  title: { romaji: string | null; english: string | null; native: string | null };
  relations: { type: string; animeId: number }[];
}

interface AniListCache {
  fetchedAt: string | null;
  media: Record<string, AniListMedia>;
  missing: number[];
}

interface EnrichOptions {
  ids: number[];
  cacheDir: string;
  http: HttpClient;
  now: () => Date;
  log: (line: string) => void;
}

const API_URL = 'https://graphql.anilist.co';
const BATCH_SIZE = 50;
// AniList allowed 30 requests a minute on 2026-09-25 (its API runs in a degraded mode), so one
// request every 2.1 s stays under it.
const REQUEST_INTERVAL_MS = 2100;
const QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${BATCH_SIZE}) {
    media(id_in: $ids, type: ANIME) {
      id isAdult popularity genres synonyms
      title { romaji english native }
      relations { edges { relationType node { id type } } }
    }
  }
}`;

const ADULT_GENRE = 'Hentai';

// Adult anime are left out of the catalog entirely, so no game can pick one, not even as a wrong option.
export function isAdultMedia(media: AniListMedia | undefined): boolean {
  return media !== undefined && (media.isAdult || media.genres.includes(ADULT_GENRE));
}

function cacheFileOf(cacheDir: string): string {
  return join(cacheDir, 'anilist', 'media.json');
}

function parseRelations(raw: unknown): { type: string; animeId: number }[] {
  const edges = isRecord(raw) ? recordsIn(raw.edges) : [];
  return edges.flatMap((edge) => {
    const node = isRecord(edge.node) ? edge.node : {};
    const type = stringOrNull(edge.relationType);
    const animeId = numberOrNull(node.id);
    return node.type === 'ANIME' && type !== null && animeId !== null ? [{ type, animeId }] : [];
  });
}

export function parseMedia(raw: JsonRecord): AniListMedia | null {
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  const title = isRecord(raw.title) ? raw.title : {};
  return {
    id,
    isAdult: raw.isAdult === true,
    popularity: numberOrNull(raw.popularity),
    genres: stringsIn(raw.genres),
    synonyms: stringsIn(raw.synonyms),
    title: {
      romaji: stringOrNull(title.romaji),
      english: stringOrNull(title.english),
      native: stringOrNull(title.native),
    },
    relations: parseRelations(raw.relations),
  };
}

function parseMediaPage(body: unknown): AniListMedia[] {
  if (!isRecord(body)) throw new Error('AniList returned no JSON object');
  const firstError = recordsIn(body.errors)[0];
  if (firstError) throw new Error(`AniList error: ${stringOrNull(firstError.message) ?? 'unknown'}`);
  const page = isRecord(body.data) && isRecord(body.data.Page) ? body.data.Page : null;
  if (page === null) throw new Error('AniList returned no Page');
  return recordsIn(page.media).map(parseMedia).filter(isPresent);
}

function readCache(file: string): AniListCache {
  if (!existsSync(file)) return { fetchedAt: null, media: {}, missing: [] };
  const raw = readJsonFile(file);
  if (!isRecord(raw) || !isRecord(raw.media)) throw new Error(`${file} is not an AniList cache`);
  return {
    fetchedAt: stringOrNull(raw.fetchedAt),
    media: raw.media as Record<string, AniListMedia>, // written by this module in exactly this shape
    missing: Array.isArray(raw.missing) ? raw.missing.filter((id): id is number => typeof id === 'number') : [],
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

// Fetches the ids that aren't cached yet. Ids AniList doesn't return are remembered as missing, so a
// rerun doesn't ask for them again; clear the cache to retry them.
export async function enrichFromAniList(options: EnrichOptions): Promise<{ fetched: number; missing: number }> {
  const file = cacheFileOf(options.cacheDir);
  const cache = readCache(file);
  const seen = new Set([...Object.keys(cache.media).map(Number), ...cache.missing]);
  const todo = [...new Set(options.ids)].filter((id) => !seen.has(id)).sort((a, b) => a - b);
  const batches = chunks(todo, BATCH_SIZE);
  let fetched = 0;
  for (const [index, batch] of batches.entries()) {
    const media = parseMediaPage(await postJson(options.http, API_URL, { query: QUERY, variables: { ids: batch } }));
    for (const entry of media) cache.media[String(entry.id)] = entry;
    const returned = new Set(media.map((entry) => entry.id));
    cache.missing.push(...batch.filter((id) => !returned.has(id)));
    cache.fetchedAt = options.now().toISOString();
    writeJsonFile(file, cache);
    fetched += media.length;
    options.log(`batch ${index + 1}/${batches.length}: ${media.length} of ${batch.length} found`);
    await options.http.sleep(REQUEST_INTERVAL_MS);
  }
  return { fetched, missing: todo.length - fetched };
}

export function loadAniList(cacheDir: string): { media: Map<number, AniListMedia>; fetchedAt: string | null } {
  const cache = readCache(cacheFileOf(cacheDir));
  return { media: new Map(Object.values(cache.media).map((entry) => [entry.id, entry])), fetchedAt: cache.fetchedAt };
}
