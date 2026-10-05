import { expect, test } from 'vitest';
import { optionTitle, otherTitles } from './format.ts';

const OPTIONS = {
  english: ['Attack on Titan', 'Naruto', 'Your Lie in April', 'Bleach'],
  romaji: ['Shingeki no Kyojin', 'NARUTO', 'Shigatsu wa Kimi no Uso', 'Bleach'],
  japanese: ['進撃の巨人', 'ナルト', '四月は君の嘘', 'ブリーチ'],
};

test('an option shows its title in the first language, and in the second under it', () => {
  expect(optionTitle(OPTIONS, 0, { first: 'english', second: 'romaji' })).toEqual({
    text: 'Attack on Titan',
    lang: undefined,
    second: { text: 'Shingeki no Kyojin', lang: undefined },
  });
  expect(optionTitle(OPTIONS, 2, { first: 'english', second: 'japanese' }).second).toEqual({
    text: '四月は君の嘘',
    lang: 'ja',
  });
  expect(optionTitle(OPTIONS, 2, { first: 'japanese', second: null })).toEqual({
    text: '四月は君の嘘',
    lang: 'ja',
    second: null,
  });
});

test('a second title that reads the same as the first shows once', () => {
  expect(optionTitle(OPTIONS, 1, { first: 'english', second: 'romaji' }).second).toBeNull();
  expect(optionTitle(OPTIONS, 3, { first: 'english', second: 'romaji' }).second).toBeNull();
});

test("the reveal lists the anime's other titles with the second language first", () => {
  const anime = { english: 'Attack on Titan', romaji: 'Shingeki no Kyojin', japanese: '進撃の巨人' };
  const shown = { text: 'Attack on Titan', lang: undefined };
  expect(otherTitles(anime, shown, 'japanese').map((title) => title.text)).toEqual([
    '進撃の巨人',
    'Shingeki no Kyojin',
  ]);
  expect(otherTitles(anime, shown, null).map((title) => title.text)).toEqual(['Shingeki no Kyojin', '進撃の巨人']);
  const naruto = { english: 'Naruto', romaji: 'NARUTO', japanese: 'NARUTO -ナルト-' };
  expect(otherTitles(naruto, { text: 'Naruto', lang: undefined }, 'romaji').map((title) => title.text)).toEqual([
    'NARUTO -ナルト-',
  ]);
});
