import { beforeEach, expect, test } from 'vitest';
import { MAX_LINES, markSeen, notesToShow } from './whats-new.ts';

beforeEach(() => localStorage.clear());

test('a first visit shows nothing and notes the version', () => {
  expect(notesToShow(localStorage, '1.4.0')).toEqual([]);
  expect(localStorage.getItem('ysto_seen_version')).toBe('1.4.0');
  expect(notesToShow(localStorage, '1.4.0')).toEqual([]);
});

test('shows the newest lines since the last version seen, up to this one, until marked seen', () => {
  localStorage.setItem('ysto_seen_version', '1.1.0');
  const lines = notesToShow(localStorage, '1.4.0');
  expect(lines[0]).toMatch(/every song of the game/);
  expect(lines.some((line) => /two languages/.test(line))).toBe(false);
  expect(notesToShow(localStorage, '1.1.5')).toEqual([]);
  markSeen(localStorage, '1.4.0');
  expect(notesToShow(localStorage, '1.4.0')).toEqual([]);
});

test('shows three lines at most, and nothing when storage is blocked', () => {
  localStorage.setItem('ysto_seen_version', '0.1.0');
  expect(notesToShow(localStorage, '99.0.0').length).toBeLessThanOrEqual(MAX_LINES);
  expect(notesToShow(null, '99.0.0')).toEqual([]);
});
