// How places, points, times, titles and credits read on screen.
import type { OptionTitles, RevealDetails, SongCredit } from '../shared/protocol.ts';
import { TITLE_LANGUAGES } from '../shared/settings.ts';
import type { TitleLanguage } from '../shared/settings.ts';

const ORDINALS = new Intl.PluralRules('en', { type: 'ordinal' });
const SUFFIXES: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
// A real minus sign: a hyphen reads as a dash in large type.
const MINUS = '−';

export function place(rank: number): string {
  return `${rank}${SUFFIXES[ORDINALS.select(rank)] ?? 'th'}`;
}

// Places for scores sorted from highest, shared on a tie: 10, 10, 7 place 1st, 1st and 3rd.
export function sharedPlaces(sortedScores: readonly number[]): number[] {
  return sortedScores.map((value) => sortedScores.indexOf(value) + 1);
}

export function score(value: number): string {
  const digits = Math.abs(value).toLocaleString('en');
  return value < 0 ? `${MINUS}${digits}` : digits;
}

// Points won in a round, with their sign.
export function points(value: number): string {
  return value > 0 ? `+${score(value)}` : score(value);
}

export function wins(count: number): string {
  return count === 1 ? '1 win' : `${count} wins`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function credits(artists: SongCredit[]): string {
  return artists.map((artist) => (artist.as ? `${artist.name} (as ${artist.as})` : artist.name)).join(', ');
}

// Japanese titles get lang="ja", so screen readers and fonts treat them as Japanese.
export function langOf(language: TitleLanguage): string | undefined {
  return language === 'japanese' ? 'ja' : undefined;
}

export interface Title {
  text: string;
  lang: string | undefined;
}

// The player's title languages: the first heads every title, and the second, if any, sits under it.
export interface TitleLanguages {
  first: TitleLanguage;
  second: TitleLanguage | null;
}

export interface OptionTitle extends Title {
  second: Title | null; // in the second language, unless it reads the same as the first
}

// Titles that differ only in case or width, such as "Naruto" and "NARUTO", read as one.
function titleKey(title: string): string {
  return title.normalize('NFKC').toLowerCase();
}

// An option's title in the player's languages. Each list is complete: the server fell back to romaji for a
// language one of the four options lacks (server/game/titles.ts).
export function optionTitle(options: OptionTitles, index: number, languages: TitleLanguages): OptionTitle {
  const text = options[languages.first][index] ?? '';
  const secondText = languages.second ? (options[languages.second][index] ?? '') : '';
  const second =
    languages.second && secondText && titleKey(secondText) !== titleKey(text)
      ? { text: secondText, lang: langOf(languages.second) }
      : null;
  return { text, lang: langOf(languages.first), second };
}

type AnimeTitles = RevealDetails['anime'];

// The anime's title in the player's language, or romaji, which every anime has.
export function animeTitle(anime: AnimeTitles, language: TitleLanguage): Title {
  const text = anime[language];
  return text ? { text, lang: langOf(language) } : { text: anime.romaji, lang: undefined };
}

// Its titles in the other languages, each once, for the reveal to teach: the player's second language first.
export function otherTitles(anime: AnimeTitles, shown: Title, second: TitleLanguage | null): Title[] {
  const seen = new Set([titleKey(shown.text)]);
  const order = second ? [second, ...TITLE_LANGUAGES.filter((language) => language !== second)] : TITLE_LANGUAGES;
  const candidates = order.map((language): Title => ({ text: anime[language] ?? '', lang: langOf(language) }));
  return candidates.filter((title) => {
    if (title.text === '' || seen.has(titleKey(title.text))) return false;
    seen.add(titleKey(title.text));
    return true;
  });
}

export function aired(season: string | null, year: number | null): string | null {
  if (year === null) return null;
  return season ? `${season} ${year}` : String(year);
}
