// Builds a game's questions: which songs play, where each sample starts, and the four options
// (docs/product-specs/questions.md). Everything here is decided on the server; a Question holds the answer
// and must never be sent to a client as it is (docs/design-docs/anti-cheat.md).
import type { OptionTitles, RevealDetails, RoundAsk, RoundHint } from '../../shared/protocol.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import type { Catalog, CatalogAnime, CatalogTheme } from '../catalog/load.ts';
import { pickDistractors } from './distractors.ts';
import { asks, optionText, songDistractors } from './song-options.ts';
import type { SongAsk } from './song-options.ts';
import { distinctAnime, eligibleThemes, LEAD_IN_MS, optionUniverse, sampleLengthMs, TAIL_MS } from './pool.ts';
import { pick, shuffle } from './random.ts';
import type { Random } from './random.ts';
import { optionTitles } from './titles.ts';

export interface Question {
  themeId: number;
  animeId: number;
  clip: { relPath: string; startMs: number; lengthMs: number };
  options: { animeIds: number[]; titles: OptionTitles };
  ask: RoundAsk; // what the options name
  correctIndex: number;
  reveal: RevealDetails;
  hint: RoundHint; // when the anime aired, for a player who asks; never more than the reveal shows
}

function animeOf(catalog: Catalog, id: number): CatalogAnime {
  const anime = catalog.anime.get(id);
  if (!anime) throw new Error(`Theme refers to anime ${id}, which the catalog doesn't have`);
  return anime;
}

function revealOf(answer: CatalogAnime, theme: CatalogTheme): RevealDetails {
  const { english, romaji, native, display } = answer.titles;
  return {
    anime: { english, romaji: romaji ?? display, japanese: native },
    theme: { kind: theme.kind, sequence: theme.sequence },
    song: { title: theme.songTitle, artists: theme.artists },
    year: answer.year,
    season: answer.season,
    slug: answer.slug,
    cover: answer.coverFile === null ? null : `/covers/${answer.coverFile}`,
  };
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

// A mixed game draws each round's kind from those its theme can ask.
function askOf(theme: CatalogTheme, settings: LobbySettings, random: Random): RoundAsk {
  if (settings.questions !== 'mixed') return settings.questions;
  const songAsks: SongAsk[] = ['song', 'artist'];
  return pick(['anime', ...songAsks.filter((ask) => asks(theme, ask))], random);
}

// The same text in every title language: a song's title and its credits have only the one.
function sameInEveryLanguage(texts: string[]): OptionTitles {
  return { english: texts, romaji: [...texts], japanese: [...texts] };
}

function songOptions(
  catalog: Catalog,
  theme: CatalogTheme,
  answer: CatalogAnime,
  ask: SongAsk,
  universe: CatalogAnime[],
  random: Random,
): Pick<Question, 'options' | 'correctIndex'> {
  const lobbyAnime = new Set(universe.map((anime) => anime.id));
  const wrong = songDistractors(catalog, { theme, anime: answer }, ask, lobbyAnime, random);
  const options = shuffle([theme, ...wrong], random);
  return {
    options: {
      animeIds: options.map((option) => option.animeId),
      titles: sameInEveryLanguage(options.map((option) => optionText(option, ask))),
    },
    correctIndex: options.indexOf(theme),
  };
}

function animeOptions(
  catalog: Catalog,
  theme: CatalogTheme,
  answer: CatalogAnime,
  settings: LobbySettings,
  universe: CatalogAnime[],
  random: Random,
): Pick<Question, 'options' | 'correctIndex'> {
  const song = { id: theme.songId, key: theme.songKey };
  const wrong = pickDistractors(catalog, answer, song, settings.difficulty, universe, random);
  const options = shuffle([answer, ...wrong], random);
  return {
    options: { animeIds: options.map((anime) => anime.id), titles: optionTitles(options) },
    correctIndex: options.indexOf(answer),
  };
}

function buildQuestion(
  catalog: Catalog,
  theme: CatalogTheme,
  settings: LobbySettings,
  universe: CatalogAnime[],
  random: Random,
): Question {
  const answer = animeOf(catalog, theme.animeId);
  const ask = askOf(theme, settings, random);
  const { options, correctIndex } =
    ask === 'anime'
      ? animeOptions(catalog, theme, answer, settings, universe, random)
      : songOptions(catalog, theme, answer, ask, universe, random);
  return {
    themeId: theme.id,
    animeId: answer.id,
    clip: {
      relPath: theme.relPath,
      startMs: sampleStartMs(theme, settings, random),
      lengthMs: sampleLengthMs(settings),
    },
    options,
    ask,
    correctIndex,
    reveal: revealOf(answer, theme),
    hint: { format: answer.format, season: answer.season, year: answer.year },
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

// An endless game's next batch: up to `count` questions from anime none of its questions uses yet, fewer as
// the pool runs out, and none once it has.
export function moreQuestions(
  catalog: Catalog,
  settings: LobbySettings,
  random: Random,
  avoid: readonly Question[],
  count: number,
): Question[] {
  const usedAnime = new Set(avoid.map((question) => question.animeId));
  const eligible = eligibleThemes(catalog, settings).filter((theme) => !usedAnime.has(theme.animeId));
  const universe = optionUniverse(catalog, settings);
  return drawThemes(catalog, eligible, count, random).map((theme) =>
    buildQuestion(catalog, theme, settings, universe, random),
  );
}

// A round whose clip can't be cut plays another theme, drawn the same way, from an anime that none of the
// given questions (the game's, and those already tried for the round) uses.
export function replacementQuestion(
  catalog: Catalog,
  settings: LobbySettings,
  random: Random,
  avoid: readonly Question[],
): Question {
  const usedAnime = new Set(avoid.map((question) => question.animeId));
  const eligible = eligibleThemes(catalog, settings).filter((theme) => !usedAnime.has(theme.animeId));
  const [theme] = drawThemes(catalog, eligible, 1, random);
  if (!theme) throw new Error('No other anime matches the settings');
  return buildQuestion(catalog, theme, settings, optionUniverse(catalog, settings), random);
}
