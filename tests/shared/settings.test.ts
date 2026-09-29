import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCORING_PRESETS } from '../../shared/scoring.ts';
import { defaultSettings, validateSettings } from '../../shared/settings.ts';
import type { SettingsBounds } from '../../shared/settings.ts';

const bounds: SettingsBounds = { years: { from: 1963, to: 2026 }, genres: ['Action', 'Drama'], maxRank: 4000 };

test('starts a lobby with the defaults of the settings spec', () => {
  assert.deepEqual(defaultSettings(bounds), {
    sampleLengthSec: 20,
    songsPerGame: 15,
    years: { from: 1963, to: 2026 },
    genres: [],
    kinds: ['OP', 'ED'],
    formats: ['TV', 'TV Short', 'Movie', 'OVA', 'ONA', 'Special'],
    difficulty: 'normal',
    popularityRanks: { from: 1, to: 1000 },
    sampleStart: 'random',
    scoring: { mode: 'speed', streakBonus: true, comeback: false, wrongAnswerPenalty: false },
  });
});

test('starts the custom ranks at the whole catalog when it has fewer than 1,000 anime', () => {
  assert.deepEqual(defaultSettings({ ...bounds, maxRank: 210 }).popularityRanks, { from: 1, to: 210 });
});

test('gives every lobby its own copy of the defaults', () => {
  const years = { from: 1963, to: 2026 };
  const settings = defaultSettings({ ...bounds, years });
  settings.years.from = 2000;
  settings.kinds.pop();
  settings.scoring.streakBonus = false;
  assert.equal(years.from, 1963);
  assert.deepEqual(defaultSettings(bounds).kinds, ['OP', 'ED']);
  assert.equal(SCORING_PRESETS.classic.streakBonus, true);
});

test('accepts valid settings as a fresh copy', () => {
  const settings = { ...defaultSettings(bounds), genres: ['Drama'], difficulty: 'custom', sampleLengthSec: 30 };
  const valid = validateSettings(settings, bounds);
  assert.deepEqual(valid, settings);
  assert.notEqual(valid, settings);
  assert.notEqual(valid?.years, settings.years);
});

const INVALID: [string, Record<string, unknown>][] = [
  ['a sample length off the 5 s steps', { sampleLengthSec: 12 }],
  ['a sample length over 30 s', { sampleLengthSec: 35 }],
  ['a fractional song count', { songsPerGame: 7.5 }],
  ['more than 50 songs', { songsPerGame: 51 }],
  ['years before the catalog', { years: { from: 1950, to: 2000 } }],
  ['years in the wrong order', { years: { from: 2010, to: 2000 } }],
  ['a genre the settings do not offer', { genres: ['Romance'] }],
  ['a repeated genre', { genres: ['Drama', 'Drama'] }],
  ['no kinds', { kinds: [] }],
  ['an unknown format', { formats: ['Music'] }],
  ['an unknown difficulty', { difficulty: 'expert' }],
  ['ranks past the catalog', { popularityRanks: { from: 1, to: 4001 } }],
  ['rank 0', { popularityRanks: { from: 0, to: 10 } }],
  ['an unknown sample start', { sampleStart: 'chorus' }],
  ['an unknown scoring mode', { scoring: { ...SCORING_PRESETS.classic, mode: 'fastest' } }],
  ['a scoring flag that is not a boolean', { scoring: { ...SCORING_PRESETS.classic, comeback: 'yes' } }],
  ['an extra field', { extra: true }],
  ['a range with an extra field', { years: { from: 2000, to: 2010, step: 1 } }],
];

for (const [name, change] of INVALID) {
  test(`refuses ${name}`, () => {
    assert.equal(validateSettings({ ...defaultSettings(bounds), ...change }, bounds), null);
  });
}

test('refuses settings that are not an object or miss a field', () => {
  const { difficulty, ...withoutDifficulty } = defaultSettings(bounds);
  for (const value of [null, 'settings', [], withoutDifficulty]) assert.equal(validateSettings(value, bounds), null);
});
