import { beforeEach, expect, test } from 'vitest';
import { defaultSettings } from '../../shared/settings.ts';
import { MAX_SETUPS, deleteSetup, fitSetup, readSetups, saveSetup } from './saved.ts';

const BOUNDS = { years: { from: 2000, to: 2024 }, genres: ['Action', 'Drama'], maxRank: 500 };

beforeEach(() => localStorage.clear());

test('saves setups newest first, replaces one of the same name, and keeps eight', () => {
  let setups = saveSetup(localStorage, [], { name: 'A', settings: { songsPerGame: 10 } });
  setups = saveSetup(localStorage, setups, { name: 'B', settings: {} });
  setups = saveSetup(localStorage, setups, { name: 'A', settings: { songsPerGame: 20 } });
  expect(readSetups(localStorage)).toEqual([
    { name: 'A', settings: { songsPerGame: 20 } },
    { name: 'B', settings: {} },
  ]);
  for (let index = 0; index < 10; index++)
    setups = saveSetup(localStorage, setups, { name: `S${index}`, settings: {} });
  expect(readSetups(localStorage)).toHaveLength(MAX_SETUPS);
  expect(deleteSetup(localStorage, setups, 'S9').map((setup) => setup.name)).not.toContain('S9');
});

test('reads nothing from blocked or garbled storage', () => {
  expect(readSetups(null)).toEqual([]);
  localStorage.setItem('ysto_saved_settings', '{not json');
  expect(readSetups(localStorage)).toEqual([]);
  localStorage.setItem('ysto_saved_settings', JSON.stringify([{ settings: {} }, 'x']));
  expect(readSetups(localStorage)).toEqual([]);
});

test('fits a setup to the lobby: unknown genres dropped, ranges narrowed, bad fields back to default', () => {
  const saved = {
    ...defaultSettings(BOUNDS),
    songsPerGame: 30,
    genres: ['Drama', 'Romance'],
    years: { from: 1990, to: 2010 },
    sampleLengthSec: 12,
  };
  const { settings, changes } = fitSetup(saved, BOUNDS);
  expect(settings).toMatchObject({
    songsPerGame: 30,
    genres: ['Drama'],
    years: { from: 2000, to: 2010 },
    sampleLengthSec: 20,
  });
  expect(changes).toEqual([
    'The sample length went back to the default.',
    'The years were narrowed to what this catalog has.',
    "Genres this catalog doesn't offer were dropped.",
  ]);
});

test('fills fields a setup saved before they existed with their defaults, and says nothing about them', () => {
  const { answerChanges, overtimeSec, ...older } = defaultSettings(BOUNDS);
  const { settings, changes } = fitSetup({ ...older, songsPerGame: 8 }, BOUNDS);
  expect(settings).toEqual({ ...defaultSettings(BOUNDS), songsPerGame: 8, answerChanges, overtimeSec });
  expect(changes).toEqual([]);
});
