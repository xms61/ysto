// Builds a game's questions: which songs play, where each sample starts, and the four options
// (docs/product-specs/questions.md). Everything here is decided on the server; a Question holds the answer
// and must never be sent to a client as it is (docs/design-docs/anti-cheat.md).
import type { LobbySettings } from '../../shared/settings.ts';
import type { Catalog, CatalogAnime, CatalogTheme } from '../catalog/load.ts';
import { pickDistractors } from './distractors.ts';
import { distinctAnime, eligibleThemes, LEAD_IN_MS, optionUniverse, sampleLengthMs, TAIL_MS } from './pool.ts';
import { pick, shuffle } from './random.ts';
import type { Random } from './random.ts';
import { optionTitles } from './titles.ts';
import type { OptionTitles } from './titles.ts';

export interface Question {
  themeId: number;
  animeId: number;
  clip: { relPath: string; startMs: number; lengthMs: number };
  options: { animeIds: number[]; titles: OptionTitles };
  correctIndex: number;
}

function animeOf(catalog: Catalog, id: number): CatalogAnime {
  const anime = catalog.anime.get(id);
  if (!anime) throw new Error(`Theme refers to anime ${id}, which the catalog doesn't have`);
  return anime;
}

// Draws franchise, then anime, then theme, each uniformly, so a franchise with 48 anime is as likely as one
// with a single anime. An anime is removed once drawn, so it plays at most once per game.
function drawThemes(catalog: Catalog, themes: CatalogTheme[], count: number, random: Random): CatalogTheme[] {
  const byFranchise = new Map<number, Map<number, CatalogTheme[]>>();
  for (const theme of themes) {
    const franchiseId = animeOf(catalog, theme.animeId).franchiseId;
    const byAnime = byFranchise.get(franchiseId) ?? new Map<number, CatalogTheme[]>();
    byAnime.set(theme.animeId, [...(byAnime.get(theme.animeId) ?? []), theme]);
    byFranchise.set(franchiseId, byAnime);
  }
  const drawn: CatalogTheme[] = [];
  while (drawn.length < count && byFranchise.size > 0) {
    const franchiseId = pick([...byFranchise.keys()], random);
    const byAnime = byFranchise.get(franchiseId) ?? new Map<number, CatalogTheme[]>();
    const animeId = pick([...byAnime.keys()], random);
    drawn.push(pick(byAnime.get(animeId) ?? [], random));
    byAnime.delete(animeId);
    if (byAnime.size === 0) byFranchise.delete(franchiseId);
  }
  return drawn;
}

// A random start leaves the lead-in and tail clear; the pool only holds themes long enough for that.
function sampleStartMs(theme: CatalogTheme, settings: LobbySettings, random: Random): number {
  if (settings.sampleStart === 'intro') return 0;
  const latest = theme.durationMs - sampleLengthMs(settings) - TAIL_MS;
  return LEAD_IN_MS + random.int(latest - LEAD_IN_MS + 1);
}

function buildQuestion(
  catalog: Catalog,
  theme: CatalogTheme,
  settings: LobbySettings,
  universe: CatalogAnime[],
  random: Random,
): Question {
  const answer = animeOf(catalog, theme.animeId);
  const song = { id: theme.songId, key: theme.songKey };
  const wrong = pickDistractors(catalog, answer, song, settings.difficulty, universe, random);
  const options = shuffle([answer, ...wrong], random);
  return {
    themeId: theme.id,
    animeId: answer.id,
    clip: {
      relPath: theme.relPath,
      startMs: sampleStartMs(theme, settings, random),
      lengthMs: sampleLengthMs(settings),
    },
    options: { animeIds: options.map((anime) => anime.id), titles: optionTitles(options) },
    correctIndex: options.indexOf(answer),
  };
}

// Themes the lobby has played are skipped until too few anime remain, so "play again" avoids repeats until
// the pool runs out. The lobby checks poolSize before a game, so a failure here is a programming error.
export function buildGame(
  catalog: Catalog,
  settings: LobbySettings,
  random: Random,
  playedThemeIds: ReadonlySet<number> = new Set(),
): Question[] {
  const eligible = eligibleThemes(catalog, settings);
  const unplayed = eligible.filter((theme) => !playedThemeIds.has(theme.id));
  const source = distinctAnime(unplayed) >= settings.songsPerGame ? unplayed : eligible;
  if (distinctAnime(source) < settings.songsPerGame) {
    throw new Error(`Only ${distinctAnime(source)} anime match the settings; the game needs ${settings.songsPerGame}`);
  }
  const universe = optionUniverse(catalog, settings);
  return drawThemes(catalog, source, settings.songsPerGame, random).map((theme) =>
    buildQuestion(catalog, theme, settings, universe, random),
  );
}
