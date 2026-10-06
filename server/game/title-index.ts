// The typed answer's suggestions (docs/product-specs/game-flow.md): every playable anime's titles in all three
// languages and its synonyms, normalized as the options are, searched on the server. The index is the whole
// catalog's, never the round's, so a suggestion never hints at the answer (docs/design-docs/anti-cheat.md).
import type { TitleMatch } from '../../shared/protocol.ts';
import type { Catalog, CatalogAnime } from '../catalog/load.ts';
import { normalizeTitle } from './titles.ts';

export const MAX_SUGGESTIONS = 8;
export const MAX_QUERY = 80;

interface Entry {
  anime: CatalogAnime;
  keys: string[]; // its normalized titles and synonyms
}

const INDEXES = new WeakMap<Catalog, Entry[]>();

function keysOf(anime: CatalogAnime): string[] {
  const { display, romaji, english, native } = anime.titles;
  const titles = [display, romaji, english, native, ...anime.synonyms].filter((title) => title !== null);
  return [...new Set(titles.map(normalizeTitle))].filter((key) => key.length > 0);
}

function indexOf(catalog: Catalog): Entry[] {
  let index = INDEXES.get(catalog);
  if (!index) {
    index = catalog.playableAnime.map((anime) => ({ anime, keys: keysOf(anime) }));
    INDEXES.set(catalog, index);
  }
  return index;
}

export function matchOf(anime: CatalogAnime): TitleMatch {
  const { display, romaji, english, native } = anime.titles;
  return { animeId: anime.id, english, romaji: romaji ?? display, japanese: native, year: anime.year };
}

// How well an anime's keys match: 0 an exact title, 1 a title that starts with the query, 2 one that has a word
// starting with it, 3 one that has it anywhere; null for none.
function rankOf(keys: string[], query: string): number | null {
  let best: number | null = null;
  for (const key of keys) {
    const rank =
      key === query ? 0 : key.startsWith(query) ? 1 : key.includes(` ${query}`) ? 2 : key.includes(query) ? 3 : null;
    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best;
}

// The best matches for what the player typed, the closest match first, then the most popular.
export function searchTitles(catalog: Catalog, raw: string): TitleMatch[] {
  const query = normalizeTitle(raw.slice(0, MAX_QUERY));
  if (query.length < 2) return [];
  return indexOf(catalog)
    .flatMap((entry) => {
      const rank = rankOf(entry.keys, query);
      return rank === null ? [] : [{ entry, rank }];
    })
    .sort((a, b) => a.rank - b.rank || a.entry.anime.popularityPct - b.entry.anime.popularityPct)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ entry }) => matchOf(entry.anime));
}
