import { beforeEach, expect, test } from 'vitest';
import { DEFAULT_PREFS, readPrefs, writePrefs } from './prefs.ts';

beforeEach(() => localStorage.clear());

test('a new device plays at 15% in Neon Rain with English titles, and follows its motion setting', () => {
  expect(readPrefs(localStorage)).toEqual({
    volume: 15,
    theme: 'tokyo-rain',
    titleLanguage: 'english',
    secondTitleLanguage: null,
    motion: 'system',
  });
  expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
});

test('keeps the settings across a reload', () => {
  const prefs = {
    volume: 40,
    theme: 'omikuji',
    titleLanguage: 'japanese',
    secondTitleLanguage: 'romaji',
    motion: 'reduced',
  } as const;
  writePrefs(localStorage, prefs);
  expect(readPrefs(localStorage)).toEqual(prefs);
});

test('falls back field by field when a stored value is bad or missing', () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 150, theme: 'neon', titleLanguage: 'romaji' }));
  expect(readPrefs(localStorage)).toEqual({ ...DEFAULT_PREFS, titleLanguage: 'romaji' });
  localStorage.setItem('ysto_prefs', JSON.stringify({ titleLanguage: 'romaji', secondTitleLanguage: 'romaji' }));
  expect(readPrefs(localStorage)).toEqual({ ...DEFAULT_PREFS, titleLanguage: 'romaji' });
  localStorage.setItem('ysto_prefs', JSON.stringify({ secondTitleLanguage: 'klingon' }));
  expect(readPrefs(localStorage)).toEqual(DEFAULT_PREFS);
  localStorage.setItem('ysto_prefs', '{not json');
  expect(readPrefs(localStorage)).toEqual(DEFAULT_PREFS);
});

test('works on when storage is blocked', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  } as unknown as Storage; // only the two methods the prefs use
  expect(() => writePrefs(blocked, DEFAULT_PREFS)).not.toThrow();
  expect(readPrefs(blocked)).toEqual(DEFAULT_PREFS);
});

test('a retired world falls back to the default, keeping the rest', () => {
  for (const theme of ['konbini', 'sakura', 'mecha']) {
    localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 40, theme }));
    expect(readPrefs(localStorage)).toEqual({ ...DEFAULT_PREFS, volume: 40 });
  }
});
