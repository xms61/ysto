import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CatalogAnime } from '../../server/catalog/load.ts';
import { canShareOptions, normalizeTitle, optionTitles } from '../../server/game/titles.ts';
import { animeEntry } from './fixtures.ts';

function titled(id: number, titles: Partial<CatalogAnime['titles']>, year: number | null = 2010): CatalogAnime {
  return animeEntry(id, { titles: { ...animeEntry(id).titles, ...titles }, year });
}

test('compares titles without regard to character width, case or spacing', () => {
  assert.equal(normalizeTitle('  ＳＨＯＷ　One   Two '), 'show one two');
});

test('uses a language when all four options have a title in it, and romaji for all four otherwise', () => {
  const options = [titled(1, {}), titled(2, {}), titled(3, { english: null }), titled(4, {})];
  const titles = optionTitles(options);
  assert.deepEqual(titles.english, ['Show 1', 'Show 2', 'Show 3', 'Show 4']);
  assert.deepEqual(titles.romaji, ['Show 1', 'Show 2', 'Show 3', 'Show 4']);
  assert.deepEqual(titles.japanese, ['Native 1', 'Native 2', 'Native 3', 'Native 4']);
});

test('falls back from romaji to the display title', () => {
  const options = [
    titled(1, { romaji: null, display: 'Display 1' }),
    titled(2, {}),
    titled(3, {}),
    titled(4, { native: null }),
  ];
  const titles = optionTitles(options);
  assert.deepEqual(titles.romaji, ['Display 1', 'Show 2', 'Show 3', 'Show 4']);
  assert.deepEqual(titles.japanese, ['Display 1', 'Show 2', 'Show 3', 'Show 4']);
});

test('adds the year to titles that two options share, only in the language where they match', () => {
  const options = [
    titled(1, { english: 'Same Title' }, 1999),
    titled(2, { english: 'SAME  title' }, 2011),
    titled(3, {}),
    titled(4, {}),
  ];
  const titles = optionTitles(options);
  assert.deepEqual(titles.english, ['Same Title (1999)', 'SAME  title (2011)', 'English 3', 'English 4']);
  assert.deepEqual(titles.romaji, ['Show 1', 'Show 2', 'Show 3', 'Show 4']);
});

test('lets two anime share a question unless a title matches and their years cannot tell them apart', () => {
  assert.equal(canShareOptions(titled(1, {}), titled(2, {})), true, 'different titles, same year');
  assert.equal(canShareOptions(titled(1, { english: 'Same' }, 1999), titled(2, { english: 'Same' }, 2011)), true);
  assert.equal(canShareOptions(titled(1, { romaji: 'Same' }), titled(2, { romaji: 'Same' })), false, 'same year');
  assert.equal(
    canShareOptions(titled(1, { native: 'Same' }, null), titled(2, { native: 'Same' })),
    false,
    'unknown year',
  );
  assert.equal(
    canShareOptions(titled(1, { english: null }), titled(2, { english: null })),
    true,
    'missing titles never match',
  );
});
