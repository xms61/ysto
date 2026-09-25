// The four option titles in each title language (docs/product-specs/questions.md). A language is used only
// when all four options have a title in it, otherwise romaji, so a fallback never singles an option out.
// Equal titles get their years added. The server sends all three lists; each client shows one.
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import type { CatalogAnime } from '../catalog/load.ts';

export type OptionTitles = Record<TitleLanguage, string[]>;

export function normalizeTitle(title: string): string {
  return title.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function romaji(anime: CatalogAnime): string {
  return anime.titles.romaji ?? anime.titles.display;
}

function titleIn(anime: CatalogAnime, language: TitleLanguage): string | null {
  if (language === 'english') return anime.titles.english;
  if (language === 'japanese') return anime.titles.native;
  return romaji(anime);
}

// Normalized titles are compared for every candidate option, so each anime's are computed once.
const normalizedTitles = new WeakMap<CatalogAnime, (string | null)[]>();

function titleKeys(anime: CatalogAnime): (string | null)[] {
  let keys = normalizedTitles.get(anime);
  if (!keys) {
    keys = TITLE_LANGUAGES.map((language) => {
      const title = titleIn(anime, language);
      return title === null ? null : normalizeTitle(title);
    });
    normalizedTitles.set(anime, keys);
  }
  return keys;
}

// Two anime can share a question unless a title matches in some language and their years can't tell
// them apart (Hunter x Hunter 1999 and 2011 can share one; two entries with one title and one year can't).
export function canShareOptions(a: CatalogAnime, b: CatalogAnime): boolean {
  const [keysA, keysB] = [titleKeys(a), titleKeys(b)];
  const clash = keysA.some((key, index) => key !== null && key === keysB[index]);
  return !clash || (a.year !== null && b.year !== null && a.year !== b.year);
}

function withYearsOnClashes(titles: string[], options: CatalogAnime[]): string[] {
  const counts = new Map<string, number>();
  for (const title of titles) counts.set(normalizeTitle(title), (counts.get(normalizeTitle(title)) ?? 0) + 1);
  return titles.map((title, index) =>
    (counts.get(normalizeTitle(title)) ?? 0) > 1 ? `${title} (${options[index]?.year ?? '?'})` : title,
  );
}

export function optionTitles(options: CatalogAnime[]): OptionTitles {
  const list = (language: TitleLanguage) => {
    const titles = options.map((anime) => titleIn(anime, language));
    const complete = titles.every((title): title is string => title !== null);
    return withYearsOnClashes(complete ? titles : options.map(romaji), options);
  };
  return { english: list('english'), romaji: list('romaji'), japanese: list('japanese') };
}
