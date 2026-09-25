// Writes the assembled catalog to SQLite, and reads back the facts the gate checks. The new file is
// written next to the old one and renamed into place, so a failed build never leaves a broken catalog.
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL, SCHEMA_VERSION } from '../../server/catalog/schema.ts';
import type { CatalogData } from './assemble.ts';

export interface CatalogFacts {
  meta: Record<string, string>;
  animeInCatalog: number;
  animeWithPopularity: number;
  anilistIds: number[];
  playableThemes: number;
  playableAnimeWithoutTitle: number;
  genreThemeCounts: Record<string, number>;
  playablePrimaryFiles: string[];
}

function insertAnime(db: DatabaseSync, data: CatalogData): void {
  const genres = [...new Set(data.anime.flatMap((anime) => anime.genres))].sort();
  const genreIds = new Map(genres.map((name, index) => [name, index + 1]));
  const insertGenre = db.prepare('INSERT INTO genre (id, name) VALUES (?, ?)');
  for (const [name, id] of genreIds) insertGenre.run(id, name);
  const insertRow = db.prepare(
    `INSERT INTO anime (id, slug, title_display, title_romaji, title_english, title_native, synonyms_json,
       media_format, year, season, franchise_id, anilist_id, mal_id, popularity, popularity_pct, cover_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertGenreLink = db.prepare('INSERT INTO anime_genre (anime_id, genre_id) VALUES (?, ?)');
  for (const anime of data.anime) {
    insertRow.run(
      anime.id,
      anime.slug,
      anime.titleDisplay,
      anime.titleRomaji,
      anime.titleEnglish,
      anime.titleNative,
      JSON.stringify(anime.synonyms),
      anime.mediaFormat,
      anime.year,
      anime.season,
      anime.franchiseId,
      anime.anilistId,
      anime.malId,
      anime.popularity,
      anime.popularityPct,
      anime.coverFile,
    );
    for (const genre of anime.genres) {
      const genreId = genreIds.get(genre);
      if (genreId !== undefined) insertGenreLink.run(anime.id, genreId);
    }
  }
}

function insertSongs(db: DatabaseSync, data: CatalogData): void {
  const artists = new Map<number, string>();
  for (const credit of data.songs.flatMap((song) => song.artists)) {
    if (!artists.has(credit.artistId)) artists.set(credit.artistId, credit.name);
  }
  const insertArtist = db.prepare('INSERT INTO artist (id, name) VALUES (?, ?)');
  for (const [id, name] of [...artists].sort((a, b) => a[0] - b[0])) insertArtist.run(id, name);
  const insertSong = db.prepare('INSERT INTO song (id, title, identity_key) VALUES (?, ?, ?)');
  const insertCredit = db.prepare(
    'INSERT INTO song_artist (song_id, artist_id, position, credited_as) VALUES (?, ?, ?, ?)',
  );
  for (const song of data.songs) {
    insertSong.run(song.id, song.title, song.identityKey);
    for (const credit of song.artists) insertCredit.run(song.id, credit.artistId, credit.position, credit.creditedAs);
  }
}

function insertRows(db: DatabaseSync, data: CatalogData, meta: Record<string, string>): void {
  const insertMeta = db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(meta).sort()) insertMeta.run(key, value);
  const insertFranchise = db.prepare('INSERT INTO franchise (id, name) VALUES (?, ?)');
  for (const franchise of data.franchises) insertFranchise.run(franchise.id, franchise.name);
  insertAnime(db, data);
  insertSongs(db, data);
  const insertTheme = db.prepare(
    'INSERT INTO theme (id, anime_id, song_id, kind, sequence, slug, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const theme of data.themes) {
    insertTheme.run(theme.id, theme.animeId, theme.songId, theme.kind, theme.sequence, theme.slug, theme.difficulty);
  }
  const insertFile = db.prepare(
    'INSERT INTO audio_file (rel_path, theme_id, duration_ms, size_bytes, is_primary) VALUES (?, ?, ?, ?, ?)',
  );
  for (const file of data.audioFiles) {
    insertFile.run(file.relPath, file.themeId, file.durationMs, file.sizeBytes, file.isPrimary ? 1 : 0);
  }
}

export function writeCatalog(file: string, data: CatalogData, meta: Record<string, string>): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  rmSync(temporary, { force: true });
  const db = new DatabaseSync(temporary);
  try {
    db.exec(SCHEMA_SQL);
    db.exec('BEGIN');
    insertRows(db, data, { ...meta, schema_version: String(SCHEMA_VERSION) });
    db.exec('COMMIT');
  } catch (error) {
    db.close();
    rmSync(temporary, { force: true });
    throw error;
  }
  db.close();
  renameSync(temporary, file);
}

function count(db: DatabaseSync, sql: string): number {
  return Number(db.prepare(sql).get()?.n ?? 0);
}

// A theme is playable exactly when the build gave it a difficulty.
const PLAYABLE_PRIMARY_FILES = `SELECT f.rel_path AS rel_path FROM theme t
  JOIN audio_file f ON f.theme_id = t.id AND f.is_primary = 1
  WHERE t.difficulty IS NOT NULL ORDER BY f.rel_path`;
const PLAYABLE_ANIME_WITHOUT_TITLE = `SELECT COUNT(DISTINCT a.id) AS n FROM anime a
  JOIN theme t ON t.anime_id = a.id WHERE t.difficulty IS NOT NULL AND trim(a.title_display) = ''`;
const GENRE_THEME_COUNTS = `SELECT g.name AS name, COUNT(t.id) AS n FROM genre g
  JOIN anime_genre ag ON ag.genre_id = g.id
  JOIN theme t ON t.anime_id = ag.anime_id AND t.difficulty IS NOT NULL
  GROUP BY g.name ORDER BY g.name`;

export function readCatalogFacts(file: string): CatalogFacts {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const meta = Object.fromEntries(
      db
        .prepare('SELECT key, value FROM catalog_meta')
        .all()
        .map((row) => [String(row.key), String(row.value)]),
    );
    const playablePrimaryFiles = db
      .prepare(PLAYABLE_PRIMARY_FILES)
      .all()
      .map((row) => String(row.rel_path));
    return {
      meta,
      animeInCatalog: count(db, 'SELECT COUNT(*) AS n FROM anime'),
      animeWithPopularity: count(db, 'SELECT COUNT(*) AS n FROM anime WHERE popularity IS NOT NULL'),
      anilistIds: db
        .prepare('SELECT anilist_id FROM anime WHERE anilist_id IS NOT NULL ORDER BY anilist_id')
        .all()
        .map((row) => Number(row.anilist_id)),
      playableThemes: playablePrimaryFiles.length,
      playableAnimeWithoutTitle: count(db, PLAYABLE_ANIME_WITHOUT_TITLE),
      genreThemeCounts: Object.fromEntries(
        db
          .prepare(GENRE_THEME_COUNTS)
          .all()
          .map((row) => [String(row.name), Number(row.n)]),
      ),
      playablePrimaryFiles,
    };
  } finally {
    db.close();
  }
}
