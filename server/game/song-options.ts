// The three wrong options of a song title or artist round (docs/product-specs/questions.md): other themes' song
// titles, or their artist credits, from anime as popular as the answer's. No option shares the answer's song or
// title, an artist round never offers a credit that shares an artist with another option (so a duet can't make
// two options right), and the four options' anime come from four franchises, so no franchise points at the answer.
// Candidates come from the lobby's anime first, then the whole catalog.
import type { Catalog, CatalogAnime, CatalogTheme } from '../catalog/load.ts';
import { pick } from './random.ts';
import type { Random } from './random.ts';
import { normalizeTitle } from './titles.ts';

export type SongAsk = 'song' | 'artist';

const WRONG_OPTIONS = 3;
// The popularity bands searched in turn, tightest first, as a share of the playable anime.
const BANDS = [0.1, 0.2, 0.35, 0.6, 1];

export function creditOf(theme: CatalogTheme): string {
  return theme.artists.map((artist) => artist.name).join(', ');
}

export function asks(theme: CatalogTheme, ask: SongAsk): boolean {
  return ask === 'song' ? theme.songTitle !== null : theme.artists.length > 0;
}

// What the option reads: the song's title, or its credit.
export function optionText(theme: CatalogTheme, ask: SongAsk): string {
  return ask === 'song' ? (theme.songTitle ?? '') : creditOf(theme);
}

function artistKeys(theme: CatalogTheme): string[] {
  return theme.artists.map((artist) => normalizeTitle(artist.name));
}

function sameSong(a: CatalogTheme, b: CatalogTheme): boolean {
  return (a.songId !== null && a.songId === b.songId) || (a.songKey !== null && a.songKey === b.songKey);
}

interface Chosen {
  theme: CatalogTheme;
  anime: CatalogAnime;
  text: string; // the option's text, normalized
  artists: string[]; // the credit's artists, normalized
}

function fits(candidate: Chosen, chosen: Chosen[], ask: SongAsk): boolean {
  return chosen.every(
    (option) =>
      option.anime.franchiseId !== candidate.anime.franchiseId &&
      !sameSong(option.theme, candidate.theme) &&
      option.text !== candidate.text &&
      (ask === 'song' || !option.artists.some((name) => candidate.artists.includes(name))),
  );
}

// Every theme that can be an option of each kind, with its anime and its normalized text and artists, worked
// out once per catalog.
const CANDIDATES = new WeakMap<Catalog, Record<SongAsk, Chosen[]>>();

function candidatesOf(catalog: Catalog, ask: SongAsk): Chosen[] {
  let byAsk = CANDIDATES.get(catalog);
  if (!byAsk) {
    const all = catalog.themes.flatMap((theme): { theme: CatalogTheme; anime: CatalogAnime }[] => {
      const anime = catalog.anime.get(theme.animeId);
      return anime ? [{ theme, anime }] : [];
    });
    const of = (kind: SongAsk) => all.filter(({ theme }) => asks(theme, kind)).map((entry) => chosen(entry, kind));
    byAsk = { song: of('song'), artist: of('artist') };
    CANDIDATES.set(catalog, byAsk);
  }
  return byAsk[ask];
}

function chosen({ theme, anime }: { theme: CatalogTheme; anime: CatalogAnime }, ask: SongAsk): Chosen {
  return { theme, anime, text: normalizeTitle(optionText(theme, ask)), artists: artistKeys(theme) };
}

export function songDistractors(
  catalog: Catalog,
  answer: { theme: CatalogTheme; anime: CatalogAnime },
  ask: SongAsk,
  universe: ReadonlySet<number>,
  random: Random,
): CatalogTheme[] {
  const candidates = candidatesOf(catalog, ask);
  const pools = [candidates.filter((candidate) => universe.has(candidate.anime.id)), candidates];
  const picked: Chosen[] = [chosen(answer, ask)];
  while (picked.length <= WRONG_OPTIONS) {
    const next = nextOption(pools, picked, answer.anime.popularityPct, ask, random);
    if (!next) throw new Error(`The catalog has too few themes to build four ${ask} options`);
    picked.push(next);
  }
  return picked.slice(1).map((option) => option.theme);
}

function nextOption(
  pools: Chosen[][],
  picked: Chosen[],
  popularity: number,
  ask: SongAsk,
  random: Random,
): Chosen | undefined {
  for (const pool of pools) {
    for (const band of BANDS) {
      const near = pool.filter(
        (candidate) => Math.abs(candidate.anime.popularityPct - popularity) <= band && fits(candidate, picked, ask),
      );
      if (near.length > 0) return pick(near, random);
    }
  }
  return undefined;
}
