// Which themes a lobby's settings allow, and which anime may appear as options. Rules:
// docs/product-specs/questions.md and settings.md.
import { MEDIA_FORMATS } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import type { Catalog, CatalogAnime, CatalogTheme } from '../catalog/load.ts';

// A random sample keeps 3 s clear at the start and 5 s at the end of the song.
export const LEAD_IN_MS = 3000;
export const TAIL_MS = 5000;

// The difficulty presets as cuts over the themes' difficulty ranks: Easy keeps the easiest 20%.
const DIFFICULTY_CUTS = { easy: 0.2, normal: 0.5, hard: 1 } as const;

export function sampleLengthMs(settings: LobbySettings): number {
  return settings.sampleLengthSec * 1000;
}

function minimumDurationMs(settings: LobbySettings): number {
  const length = sampleLengthMs(settings);
  return settings.sampleStart === 'intro' ? length : LEAD_IN_MS + length + TAIL_MS;
}

// Anime without a year only pass when the year filter spans the whole catalog.
function yearMatches(anime: CatalogAnime, settings: LobbySettings, catalog: Catalog): boolean {
  const { from, to } = settings.years;
  if (anime.year === null) return from <= catalog.years.from && to >= catalog.years.to;
  return anime.year >= from && anime.year <= to;
}

// Likewise, an anime of a format outside the list (the catalog writes "Unknown") only passes when every
// format is selected.
function formatMatches(anime: CatalogAnime, settings: LobbySettings): boolean {
  const selected: readonly string[] = settings.formats;
  if (selected.includes(anime.format)) return true;
  const known: readonly string[] = MEDIA_FORMATS;
  return !known.includes(anime.format) && MEDIA_FORMATS.every((format) => selected.includes(format));
}

// The filters that describe an anime: years, genres and formats. Options respect them too, so an answer
// never stands out as the only anime from the chosen years or genres.
function animeMatches(anime: CatalogAnime, settings: LobbySettings, catalog: Catalog): boolean {
  const genreMatches = settings.genres.length === 0 || settings.genres.some((genre) => anime.genres.has(genre));
  return genreMatches && formatMatches(anime, settings) && yearMatches(anime, settings, catalog);
}

function difficultyMatches(theme: CatalogTheme, anime: CatalogAnime, settings: LobbySettings): boolean {
  if (settings.difficulty === 'custom') {
    return anime.popularityRank >= settings.popularityRanks.from && anime.popularityRank <= settings.popularityRanks.to;
  }
  return theme.difficulty <= DIFFICULTY_CUTS[settings.difficulty];
}

export function eligibleThemes(catalog: Catalog, settings: LobbySettings): CatalogTheme[] {
  const minimum = minimumDurationMs(settings);
  return catalog.themes.filter((theme) => {
    const anime = catalog.anime.get(theme.animeId);
    return (
      anime !== undefined &&
      settings.kinds.includes(theme.kind) &&
      theme.durationMs >= minimum &&
      difficultyMatches(theme, anime, settings) &&
      animeMatches(anime, settings, catalog)
    );
  });
}

// The anime that may appear as wrong options: every playable anime that passes the anime filters.
export function optionUniverse(catalog: Catalog, settings: LobbySettings): CatalogAnime[] {
  return catalog.playableAnime.filter((anime) => animeMatches(anime, settings, catalog));
}

export function distinctAnime(themes: CatalogTheme[]): number {
  return new Set(themes.map((theme) => theme.animeId)).size;
}

// What the lobby shows while the host edits settings. A game uses each anime at most once, so `anime` is
// what limits the songs per game.
export function poolSize(catalog: Catalog, settings: LobbySettings): { themes: number; anime: number } {
  const themes = eligibleThemes(catalog, settings);
  return { themes: themes.length, anime: distinctAnime(themes) };
}
