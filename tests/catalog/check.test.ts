import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateGate, GATE, seededSample } from '../../scripts/catalog/check.ts';
import type { GateInput } from '../../scripts/catalog/check.ts';

function passing(overrides: Partial<GateInput> = {}): GateInput {
  return {
    audioFiles: 1000,
    matchedFiles: 999,
    animeInCatalog: 100,
    animeWithPopularity: 99,
    playableThemes: 900,
    playableAnimeWithoutTitle: 0,
    adultAnimeInCatalog: 0,
    genreThemeCounts: { Action: 300, Drama: 200 },
    loudnessLufs: Array.from({ length: 20 }, () => -16),
    ...overrides,
  };
}

test('passes a catalog that meets every rule', () => {
  assert.deepEqual(evaluateGate(passing()), { failures: [], warnings: [] });
});

const FAILURES: [name: string, input: Partial<GateInput>, failure: string][] = [
  ['too few files matched', { matchedFiles: 980 }, '98.0% of audio files match a theme; at least 99.0% must'],
  ['too little popularity data', { animeWithPopularity: 90 }, '90.0% of anime have a popularity; at least 95.0% must'],
  ['nothing playable', { playableThemes: 0 }, 'no theme is playable'],
  ['a playable anime without a title', { playableAnimeWithoutTitle: 2 }, '2 playable anime have no title'],
  ['adult anime', { adultAnimeInCatalog: 1 }, '1 adult anime are in the catalog'],
  [
    'loudness off target',
    { loudnessLufs: [-16, -16, -16, -16, -16, -16, -16, -16, -16, -9, -25, Number.NaN] },
    `75.0% of sampled files are within ${GATE.targetLufs} ± ${GATE.lufsTolerance} LUFS; at least 95.0% must be`,
  ],
];

for (const [name, input, failure] of FAILURES) {
  test(`fails on ${name}`, () => {
    assert.deepEqual(evaluateGate(passing(input)).failures, [failure]);
  });
}

test('warns about small genres and a skipped loudness check', () => {
  assert.deepEqual(
    evaluateGate(passing({ genreThemeCounts: { Action: 300, Racing: 12 }, loudnessLufs: [] })).warnings,
    ["genre Racing has 12 playable themes, fewer than 50, so settings won't offer it", 'loudness was not measured'],
  );
});

test('samples the same items for the same seed, without repeats', () => {
  const items = Array.from({ length: 50 }, (_, index) => index);
  const sample = seededSample(items, 10, 7);
  assert.deepEqual(seededSample(items, 10, 7), sample);
  assert.notDeepEqual(seededSample(items, 10, 8), sample);
  assert.equal(new Set(sample).size, 10);
  assert.equal(seededSample(items, 80, 7).length, 50);
  assert.deepEqual(seededSample(items, 0, 7), []);
});
