// Loads catalog.sqlite into memory once, at startup. The catalog is a few megabytes, so games select songs
// with plain filters instead of queries. Only playable themes and the anime that have them are kept; each
// anime also keeps the song ids and keys of all its themes, for the same-song rule.
import { DatabaseSync } from 'node:sqlite';
import type { SQLOutputValue } from 'node:sqlite';
import type { Range, ThemeKind } from '../../shared/settings.ts';
import { SCHEMA_VERSION } from './schema.ts';

export interface CatalogAnime {
  id: number;
  titles: { display: string; romaji: string | null; english: string | null; native: string | null };
  year: number | null;
  season: string | null;
  format: string;
  franchiseId: number;
  popularityPct: number; // 0 most popular .. 1 least, among playable anime
  popularityRank: number; // 1 is the most popular playable anime
  genres: ReadonlySet<string>;
  songIds: ReadonlySet<number>;
  songKeys: ReadonlySet<string>;
  coverFile: string | null;
}

export interface CatalogTheme {
  id: number;
  animeId: number;
  songId: number | null;
  songKey: string | null;
  kind: ThemeKind;
  sequence: number;
  slug: string;
  difficulty: number; // 0 easiest .. 1 hardest
  relPath: string;
  durationMs: number;
}

export interface Catalog {
  anime: ReadonlyMap<number, CatalogAnime>;
  playableAnime: CatalogAnime[]; // sorted by id
  themes: CatalogTheme[]; // playable themes, sorted by id
  genres: string[];
  years: Range;
}

type Row = Record<string, SQLOutputValue>;

const PLAYABLE_THEMES = `SELECT t.id, t.anime_id, t.song_id, s.identity_key, t.kind, t.sequence, t.slug, t.difficulty,
    f.rel_path, f.duration_ms
  FROM theme t
  JOIN audio_file f ON f.theme_id = t.id AND f.is_primary = 1
  LEFT JOIN song s ON s.id = t.song_id
  WHERE t.difficulty IS NOT NULL ORDER BY t.id`;
const ALL_THEME_SONGS = `SELECT t.anime_id, t.song_id, s.identity_key FROM theme t LEFT JOIN song s ON s.id = t.song_id`;
const PLAYABLE_ANIME = `SELECT * FROM anime a
  WHERE EXISTS (SELECT 1 FROM theme t WHERE t.anime_id = a.id AND t.difficulty IS NOT NULL) ORDER BY a.id`;
const ANIME_GENRES = `SELECT ag.anime_id, g.name FROM anime_genre ag JOIN genre g ON g.id = ag.genre_id`;

function text(value: SQLOutputValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function numeric(value: SQLOutputValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`The catalog is missing ${what}; rebuild it with npm run catalog:build`);
  return value;
}

function groupSets<T>(rows: Row[], key: string, value: (row: Row) => T | null): Map<number, Set<T>> {
  const groups = new Map<number, Set<T>>();
  for (const row of rows) {
    const id = required(numeric(row[key]), key);
    const item = value(row);
    if (item === null) continue;
    const group = groups.get(id) ?? new Set<T>();
    group.add(item);
    groups.set(id, group);
  }
  return groups;
}

function checkSchema(db: DatabaseSync): void {
  const version = db.prepare("SELECT value FROM catalog_meta WHERE key = 'schema_version'").get()?.value;
  if (version !== String(SCHEMA_VERSION)) {
    throw new Error(
      `The catalog has schema version ${String(version)}, the server needs ${SCHEMA_VERSION}; rebuild it with npm run catalog:build`,
    );
  }
}

function toTheme(row: Row): CatalogTheme {
  const kind = row.kind === 'ED' ? 'ED' : 'OP';
  return {
    id: required(numeric(row.id), 'a theme id'),
    animeId: required(numeric(row.anime_id), 'a theme anime'),
    songId: numeric(row.song_id),
    songKey: text(row.identity_key),
    kind,
    sequence: required(numeric(row.sequence), 'a theme sequence'),
    slug: required(text(row.slug), 'a theme slug'),
    difficulty: required(numeric(row.difficulty), 'a theme difficulty'),
    relPath: required(text(row.rel_path), 'a primary file'),
    durationMs: required(numeric(row.duration_ms), 'a duration'),
  };
}

export function loadCatalog(file: string): Catalog {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    checkSchema(db);
    const themes = db.prepare(PLAYABLE_THEMES).all().map(toTheme);
    const songRows = db.prepare(ALL_THEME_SONGS).all();
    const songIds = groupSets(songRows, 'anime_id', (row) => numeric(row.song_id));
    const songKeys = groupSets(songRows, 'anime_id', (row) => text(row.identity_key));
    const genres = groupSets(db.prepare(ANIME_GENRES).all(), 'anime_id', (row) => text(row.name));
    const rows = db.prepare(PLAYABLE_ANIME).all();
    const byPopularity = [...rows].sort(
      (a, b) => (numeric(a.popularity_pct) ?? 1) - (numeric(b.popularity_pct) ?? 1) || Number(a.id) - Number(b.id),
    );
    const rankOf = new Map(byPopularity.map((row, index) => [Number(row.id), index + 1]));
    const playableAnime = rows.map((row): CatalogAnime => {
      const id = required(numeric(row.id), 'an anime id');
      return {
        id,
        titles: {
          display: required(text(row.title_display), 'a display title'),
          romaji: text(row.title_romaji),
          english: text(row.title_english),
          native: text(row.title_native),
        },
        year: numeric(row.year),
        season: text(row.season),
        format: required(text(row.media_format), 'a media format'),
        franchiseId: required(numeric(row.franchise_id), 'a franchise'),
        popularityPct: required(numeric(row.popularity_pct), 'a popularity rank'),
        popularityRank: rankOf.get(id) ?? rows.length,
        genres: genres.get(id) ?? new Set(),
        songIds: songIds.get(id) ?? new Set(),
        songKeys: songKeys.get(id) ?? new Set(),
        coverFile: text(row.cover_file),
      };
    });
    const years = playableAnime.map((anime) => anime.year).filter((year) => year !== null);
    if (years.length === 0) throw new Error('The catalog has no playable anime; rebuild it with npm run catalog:build');
    return {
      anime: new Map(playableAnime.map((anime) => [anime.id, anime])),
      playableAnime,
      themes,
      genres: [...new Set(playableAnime.flatMap((anime) => [...anime.genres]))].sort(),
      years: { from: Math.min(...years), to: Math.max(...years) },
    };
  } finally {
    db.close();
  }
}
