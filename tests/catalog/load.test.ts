import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { loadCatalog } from '../../server/catalog/load.ts';
import { SCHEMA_VERSION } from '../../server/catalog/schema.ts';
import { assembleCatalog } from '../../scripts/catalog/assemble.ts';
import { writeCatalog } from '../../scripts/catalog/store.ts';
import { anime, media, probed, theme } from './fixtures.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Anime 1 has two playable openings and a 5 s ending; anime 2 one playable opening; anime 3 only a 5 s one.
function writeSampleCatalog(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-load-'));
  dirs.push(dir);
  const file = join(dir, 'catalog.sqlite');
  const data = assembleCatalog({
    animeThemes: [
      anime(1, {
        anilistId: 100,
        themes: [
          theme(11, 'A-OP1'),
          theme(12, 'A-ED1', { kind: 'ED', slug: 'ED1' }),
          theme(13, 'A-OP2', { sequence: 2, slug: 'OP2' }),
        ],
      }),
      anime(2, { anilistId: 200, year: 2015, mediaFormat: 'Movie', themes: [theme(21, 'B-OP1')] }),
      anime(3, { anilistId: null, themes: [theme(31, 'C-OP1')] }),
    ],
    aniList: new Map([
      [100, media(100, { popularity: 5000, genres: ['Drama', 'Music'] })],
      [
        200,
        media(200, {
          popularity: 1000,
          genres: ['Action'],
          title: { romaji: 'Romaji 200', english: null, native: null },
        }),
      ],
    ]),
    audio: [
      probed('A-OP1.ogg'),
      probed('A-ED1.ogg', 5000),
      probed('A-OP2.ogg', 60_000),
      probed('B-OP1.ogg'),
      probed('C-OP1.ogg', 5000),
    ],
    coverFiles: new Map([[1, 'covers/1.jpg']]),
  });
  writeCatalog(file, data, {});
  return file;
}

test('loads the playable anime and themes, with every theme song of each anime', () => {
  const catalog = loadCatalog(writeSampleCatalog());
  assert.deepEqual(
    catalog.playableAnime.map((entry) => entry.id),
    [1, 2],
  );
  const first = catalog.anime.get(1);
  assert.ok(first);
  assert.deepEqual(first.titles, {
    display: 'Anime 1',
    romaji: 'Romaji 100',
    english: 'English 100',
    native: 'Native 100',
  });
  assert.equal(first.year, 2020);
  assert.equal(first.format, 'TV');
  assert.equal(first.popularityPct, 0);
  assert.equal(first.popularityRank, 1);
  assert.deepEqual([...first.genres].sort(), ['Drama', 'Music']);
  // The short ending isn't playable, but an option still must not share its song.
  assert.deepEqual([...first.songIds].sort(), [11, 12, 13]);
  assert.equal(first.songKeys.size, 3);
  assert.equal(first.coverFile, 'covers/1.jpg');
  const second = catalog.anime.get(2);
  assert.deepEqual(second?.titles, { display: 'Anime 2', romaji: 'Romaji 200', english: null, native: null });
  assert.equal(second?.popularityRank, 2);
  assert.equal(second?.format, 'Movie');
  assert.deepEqual(
    catalog.themes.map((entry) => [entry.id, entry.animeId, entry.kind, entry.slug, entry.relPath, entry.durationMs]),
    [
      [11, 1, 'OP', 'OP1', 'A-OP1.ogg', 90_000],
      [13, 1, 'OP', 'OP2', 'A-OP2.ogg', 60_000],
      [21, 2, 'OP', 'OP1', 'B-OP1.ogg', 90_000],
    ],
  );
  assert.ok(catalog.themes.every((entry) => entry.difficulty >= 0 && entry.difficulty <= 1 && entry.songKey !== null));
  assert.deepEqual(catalog.genres, ['Action', 'Drama', 'Music']);
  assert.deepEqual(catalog.years, { from: 2015, to: 2020 });
});

test('refuses a catalog built for another schema version', () => {
  const file = writeSampleCatalog();
  const db = new DatabaseSync(file);
  db.prepare("UPDATE catalog_meta SET value = '0' WHERE key = 'schema_version'").run();
  db.close();
  assert.throws(
    () => loadCatalog(file),
    new RegExp(`schema version 0, the server needs ${SCHEMA_VERSION}; rebuild it with npm run catalog:build`),
  );
});
