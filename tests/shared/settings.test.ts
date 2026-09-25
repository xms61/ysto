import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCORING_PRESETS } from '../../shared/scoring.ts';
import { defaultSettings } from '../../shared/settings.ts';

test('starts a lobby with the defaults of the settings spec', () => {
  assert.deepEqual(defaultSettings({ from: 1963, to: 2026 }), {
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

test('gives every lobby its own copy of the defaults', () => {
  const years = { from: 1963, to: 2026 };
  const settings = defaultSettings(years);
  settings.years.from = 2000;
  settings.kinds.pop();
  settings.scoring.streakBonus = false;
  assert.equal(years.from, 1963);
  assert.deepEqual(defaultSettings(years).kinds, ['OP', 'ED']);
  assert.equal(SCORING_PRESETS.classic.streakBonus, true);
});
