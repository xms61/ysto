// How places, points, times, titles and credits read on screen.
import type { RevealDetails, SongCredit } from '../shared/protocol.ts';
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

type AnimeTitles = RevealDetails['anime'];

// The anime's title in the player's language, or romaji, which every anime has.
export function animeTitle(anime: AnimeTitles, language: TitleLanguage): Title {
  const text = anime[language];
  return text ? { text, lang: langOf(language) } : { text: anime.romaji, lang: undefined };
}

// Its titles in the other languages, each once, for the reveal to teach.
export function otherTitles(anime: AnimeTitles, shown: Title): Title[] {
  const seen = new Set([shown.text]);
  const candidates: Title[] = [
    { text: anime.english ?? '', lang: undefined },
    { text: anime.romaji, lang: undefined },
    { text: anime.japanese ?? '', lang: 'ja' },
  ];
  return candidates.filter((title) => {
    if (title.text === '' || seen.has(title.text)) return false;
    seen.add(title.text);
    return true;
  });
}

export function aired(season: string | null, year: number | null): string | null {
  if (year === null) return null;
  return season ? `${season} ${year}` : String(year);
}
