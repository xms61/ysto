import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { SCHEMA_VERSION } from '../../server/catalog/schema.ts';
import { assembleCatalog } from '../../scripts/catalog/assemble.ts';
import { renderSchemaDoc } from '../../scripts/catalog/schema-doc.ts';
import { readCatalogFacts, writeCatalog } from '../../scripts/catalog/store.ts';
import { anime, media, probed, theme } from './fixtures.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function catalogFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-store-'));
  dirs.push(dir);
  return join(dir, 'catalog', 'catalog.sqlite');
}

function sampleCatalog(extraThemes = 0) {
  const themes = [
    theme(11, 'A-OP1'),
    ...Array.from({ length: extraThemes }, (_, index) => theme(20 + index, `A-OP${index + 2}`)),
  ];
  const audio = [
    probed('A-OP1.ogg'),
    ...themes.slice(1).map((item) => probed(`${item.videos[0]?.basename.replace('.webm', '.ogg')}`)),
  ];
  const shortTheme = theme(12, 'A-ED1', { kind: 'ED', slug: 'ED1' });
  return assembleCatalog({
    animeThemes: [anime(1, { anilistId: 100, themes: [...themes, shortTheme] }), anime(2, { anilistId: null })],
    aniList: new Map([[100, media(100, { genres: ['Drama', 'Music'] })]]),
    audio: [...audio, probed('A-ED1.ogg', 5000)],
    coverFiles: new Map(),
  });
}

test('writes the catalog and reads back the facts the gate checks', () => {
  const file = catalogFile();
  writeCatalog(file, sampleCatalog(), { built_at: '2026-09-25T12:00:00.000Z', audio_files_total: '2' });
  const facts = readCatalogFacts(file);
  assert.deepEqual(facts, {
    meta: { audio_files_total: '2', built_at: '2026-09-25T12:00:00.000Z', schema_version: String(SCHEMA_VERSION) },
    animeInCatalog: 2,
    animeWithPopularity: 1,
    anilistIds: [100],
    playableThemes: 1,
    playableAnimeWithoutTitle: 0,
    genreThemeCounts: { Drama: 1, Music: 1 },
    playablePrimaryFiles: ['A-OP1.ogg'],
  });
});

test('replaces an existing catalog and leaves no temporary file behind', () => {
  const file = catalogFile();
  writeCatalog(file, sampleCatalog(), {});
  writeCatalog(file, sampleCatalog(2), {});
  assert.equal(readCatalogFacts(file).playableThemes, 3);
  assert.deepEqual(readdirSync(join(file, '..')), ['catalog.sqlite']);
});

test('removes the temporary file when a write fails', () => {
  const file = catalogFile();
  const broken = sampleCatalog();
  broken.anime.push({ ...broken.anime[0]!, slug: 'duplicate id' });
  assert.throws(() => writeCatalog(file, broken, {}), /UNIQUE constraint failed: anime.id/);
  assert.equal(existsSync(file), false);
  assert.equal(existsSync(`${file}.tmp`), false);
});

test('renders the schema doc with every table', () => {
  const doc = renderSchemaDoc();
  for (const table of [
    'catalog_meta',
    'franchise',
    'anime',
    'genre',
    'anime_genre',
    'artist',
    'song',
    'song_artist',
    'theme',
    'audio_file',
  ]) {
    assert.match(doc, new RegExp(`CREATE TABLE ${table} \\(`));
  }
  assert.match(doc, new RegExp(`schema version ${SCHEMA_VERSION}`));
});
