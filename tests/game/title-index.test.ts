import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchTitles } from '../../server/game/title-index.ts';
import { animeEntry, catalogOf, themeEntry } from './fixtures.ts';

const catalog = catalogOf(
  [
    animeEntry(1, {
      titles: {
        display: 'Shingeki no Kyojin',
        romaji: 'Shingeki no Kyojin',
        english: 'Attack on Titan',
        native: '進撃の巨人',
      },
      synonyms: ['AoT', 'SnK'],
      popularityPct: 0.01,
      year: 2013,
    }),
    animeEntry(2, {
      titles: { display: 'Hunter x Hunter', romaji: 'Hunter x Hunter', english: 'Hunter x Hunter', native: null },
      popularityPct: 0.2,
      year: 1999,
    }),
    animeEntry(3, {
      titles: {
        display: 'Hunter x Hunter (2011)',
        romaji: 'Hunter x Hunter (2011)',
        english: 'Hunter x Hunter',
        native: null,
      },
      popularityPct: 0.02,
      year: 2011,
    }),
    animeEntry(4, {
      titles: { display: 'Titan Days', romaji: 'Titan Days', english: null, native: null },
      popularityPct: 0.5,
      year: 2020,
    }),
  ],
  [themeEntry(1, 1), themeEntry(2, 2), themeEntry(3, 3), themeEntry(4, 4)],
);

const ids = (query: string) => searchTitles(catalog, query).map((match) => match.animeId);

test('finds an anime by any of its titles, ignoring case and full-width characters', () => {
  assert.deepEqual(ids('attack on titan'), [1]);
  assert.deepEqual(ids('ＳＨＩＮＧＥＫＩ'), [1]);
  assert.deepEqual(ids('進撃'), [1]);
});

test('finds an anime by a synonym', () => {
  assert.deepEqual(ids('aot'), [1]);
});

test('ranks an exact title first, then titles that start with the query, then the rest, then popularity', () => {
  assert.deepEqual(ids('titan'), [4, 1]);
});

test('lists remakes apart, each with its year', () => {
  const matches = searchTitles(catalog, 'hunter x hunter');
  assert.deepEqual(
    matches.map((match) => [match.animeId, match.year]),
    [
      [3, 2011],
      [2, 1999],
    ],
  );
});

test('suggests nothing for a query shorter than two characters', () => {
  assert.deepEqual(ids('a'), []);
  assert.deepEqual(ids('  '), []);
});
