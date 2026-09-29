import { beforeEach, expect, test } from 'vitest';
import { DEFAULT_PREFS, readPrefs, writePrefs } from './prefs.ts';

beforeEach(() => localStorage.clear());

test('a new device plays at 15% in Tokyo Rain with English titles, and follows its motion setting', () => {
  expect(readPrefs(localStorage)).toEqual({
    volume: 15,
    theme: 'tokyo-rain',
    titleLanguage: 'english',
    motion: 'system',
  });
  expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
});

test('keeps the settings across a reload', () => {
  const prefs = { volume: 40, theme: 'sakura', titleLanguage: 'japanese', motion: 'reduced' } as const;
  writePrefs(localStorage, prefs);
  expect(readPrefs(localStorage)).toEqual(prefs);
});

test('falls back field by field when a stored value is bad or missing', () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 150, theme: 'neon', titleLanguage: 'romaji' }));
  expect(readPrefs(localStorage)).toEqual({ ...DEFAULT_PREFS, titleLanguage: 'romaji' });
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
