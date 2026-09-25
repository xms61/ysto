import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eligibleThemes, optionUniverse, poolSize } from '../../server/game/pool.ts';
import { MEDIA_FORMATS } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { animeEntry, catalogOf, settingsFor, themeEntry } from './fixtures.ts';

function ids(items: { id: number }[]): number[] {
  return items.map((item) => item.id);
}

test('keeps themes long enough for the sample, the 3 s lead-in and the 5 s tail', () => {
  const catalog = catalogOf(
    [animeEntry(1)],
    [
      themeEntry(1, 1, { durationMs: 28_000 }),
      themeEntry(2, 1, { durationMs: 27_999 }),
      themeEntry(3, 1, { durationMs: 19_999 }),
    ],
  );
  assert.deepEqual(ids(eligibleThemes(catalog, settingsFor(catalog, { sampleLengthSec: 20 }))), [1]);
  // An intro sample starts at 0 s, so it only needs the sample itself.
  assert.deepEqual(
    ids(eligibleThemes(catalog, settingsFor(catalog, { sampleLengthSec: 20, sampleStart: 'intro' }))),
    [1, 2],
  );
});

test('filters themes by OP and ED', () => {
  const catalog = catalogOf([animeEntry(1)], [themeEntry(1, 1), themeEntry(2, 1, { kind: 'ED', slug: 'ED1' })]);
  assert.deepEqual(ids(eligibleThemes(catalog, settingsFor(catalog, { kinds: ['ED'] }))), [2]);
  assert.deepEqual(ids(eligibleThemes(catalog, settingsFor(catalog, { kinds: ['OP', 'ED'] }))), [1, 2]);
});

test('cuts the presets over theme difficulty, and Custom over anime popularity rank', () => {
  const catalog = catalogOf(
    [animeEntry(1, { popularityPct: 0.1 }), animeEntry(2, { popularityPct: 0.9 })],
    [
      themeEntry(1, 1, { difficulty: 0.2 }),
      themeEntry(2, 1, { difficulty: 0.21 }),
      themeEntry(3, 2, { difficulty: 0.5 }),
      themeEntry(4, 2, { difficulty: 0.9 }),
    ],
  );
  const themesFor = (overrides: Partial<LobbySettings>) =>
    ids(eligibleThemes(catalog, settingsFor(catalog, overrides)));
  assert.deepEqual(themesFor({ difficulty: 'easy' }), [1]);
  assert.deepEqual(themesFor({ difficulty: 'normal' }), [1, 2, 3]);
  assert.deepEqual(themesFor({ difficulty: 'hard' }), [1, 2, 3, 4]);
  assert.deepEqual(themesFor({ difficulty: 'custom', popularityRanks: { from: 1, to: 1 } }), [1, 2]);
  assert.deepEqual(themesFor({ difficulty: 'custom', popularityRanks: { from: 2, to: 5 } }), [3, 4]);
});

test('filters anime by genre (any of the chosen ones), format and years', () => {
  const anime = [
    animeEntry(1, { genres: new Set(['Action']), format: 'TV', year: 2000 }),
    animeEntry(2, { genres: new Set(['Drama', 'Comedy']), format: 'Movie', year: 2010 }),
    animeEntry(3, { genres: new Set(['Romance']), format: 'OVA', year: 2020 }),
  ];
  const catalog = catalogOf(anime, [themeEntry(1, 1), themeEntry(2, 2), themeEntry(3, 3)]);
  const animeFor = (overrides: Partial<LobbySettings>) => ids(optionUniverse(catalog, settingsFor(catalog, overrides)));
  assert.deepEqual(animeFor({}), [1, 2, 3]);
  assert.deepEqual(animeFor({ genres: ['Comedy', 'Romance'] }), [2, 3]);
  assert.deepEqual(animeFor({ formats: ['Movie'] }), [2]);
  assert.deepEqual(animeFor({ years: { from: 2005, to: 2020 } }), [2, 3]);
  assert.deepEqual(ids(eligibleThemes(catalog, settingsFor(catalog, { genres: ['Action'] }))), [1]);
});

test('lets anime without a year or with an unknown format through only while that filter is wide open', () => {
  const anime = [
    animeEntry(1, { year: 2000 }),
    animeEntry(2, { year: 2020 }),
    animeEntry(3, { year: null }),
    animeEntry(4, { format: 'Unknown' }),
  ];
  const catalog = catalogOf(anime, [themeEntry(1, 1), themeEntry(2, 2), themeEntry(3, 3), themeEntry(4, 4)]);
  const animeFor = (overrides: Partial<LobbySettings>) => ids(optionUniverse(catalog, settingsFor(catalog, overrides)));
  assert.deepEqual(animeFor({}), [1, 2, 3, 4]);
  assert.deepEqual(animeFor({ years: { from: 2000, to: 2019 } }), [1, 4]);
  assert.deepEqual(animeFor({ formats: MEDIA_FORMATS.filter((format) => format !== 'Special') }), [1, 2, 3]);
});

test('offers as options every anime that passes the anime filters, whatever its themes', () => {
  const catalog = catalogOf(
    [animeEntry(1), animeEntry(2, { year: 1990 })],
    [themeEntry(1, 1, { kind: 'ED', slug: 'ED1', difficulty: 0.9 }), themeEntry(2, 2)],
  );
  const settings = settingsFor(catalog, { kinds: ['OP'], difficulty: 'easy', years: { from: 2000, to: 2010 } });
  assert.deepEqual(ids(eligibleThemes(catalog, settings)), []);
  assert.deepEqual(ids(optionUniverse(catalog, settings)), [1]);
});

test('counts the pool in themes and in distinct anime, which limit the songs per game', () => {
  const catalog = catalogOf(
    [animeEntry(1), animeEntry(2)],
    [themeEntry(1, 1), themeEntry(2, 1, { kind: 'ED', slug: 'ED1' }), themeEntry(3, 1), themeEntry(4, 2)],
  );
  assert.deepEqual(poolSize(catalog, settingsFor(catalog)), { themes: 4, anime: 2 });
  assert.deepEqual(poolSize(catalog, settingsFor(catalog, { kinds: ['ED'] })), { themes: 1, anime: 1 });
});
