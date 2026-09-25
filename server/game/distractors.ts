// The three wrong options for a question (docs/product-specs/questions.md). Never an anime with the answer's
// song, never two options that can't be told apart, and never a franchise pattern that points at the answer:
// the options come from four franchises, or on Hard from two franchises with two options each. Candidates are
// searched from the tightest match to the loosest, first among the lobby's anime, then across the catalog.
import type { Difficulty } from '../../shared/settings.ts';
import type { Catalog, CatalogAnime } from '../catalog/load.ts';
import { pick } from './random.ts';
import type { Random } from './random.ts';
import { canShareOptions } from './titles.ts';

const WRONG_OPTIONS = 3;

interface Level {
  band: number; // largest popularity-rank distance from the answer, 0..1
  era: number | null; // largest year distance, or none
  sharedGenre: boolean;
  sameFormatFamily: boolean;
}

// The first level of each difficulty is its rule in the spec; the rest are the relaxation steps.
const LEVELS: Record<'easy' | 'normal' | 'hard', Level[]> = {
  easy: [
    { band: 0.25, era: null, sharedGenre: false, sameFormatFamily: true },
    { band: 0.4, era: null, sharedGenre: false, sameFormatFamily: true },
    { band: 0.6, era: null, sharedGenre: false, sameFormatFamily: false },
    { band: 1, era: null, sharedGenre: false, sameFormatFamily: false },
  ],
  normal: [
    { band: 0.15, era: 8, sharedGenre: false, sameFormatFamily: true },
    { band: 0.25, era: 12, sharedGenre: false, sameFormatFamily: true },
    { band: 0.35, era: 20, sharedGenre: false, sameFormatFamily: false },
    { band: 0.5, era: null, sharedGenre: false, sameFormatFamily: false },
    { band: 1, era: null, sharedGenre: false, sameFormatFamily: false },
  ],
  hard: [
    { band: 0.1, era: 3, sharedGenre: true, sameFormatFamily: true },
    { band: 0.15, era: 5, sharedGenre: true, sameFormatFamily: true },
    { band: 0.25, era: 8, sharedGenre: true, sameFormatFamily: false },
    { band: 0.4, era: 15, sharedGenre: false, sameFormatFamily: false },
    { band: 1, era: null, sharedGenre: false, sameFormatFamily: false },
  ],
};

interface AnswerSong {
  id: number | null;
  key: string | null;
}

interface Context {
  answer: CatalogAnime;
  song: AnswerSong;
  chosen: CatalogAnime[];
}

interface Step {
  pool: CatalogAnime[];
  level: Level;
}

type Pair = [CatalogAnime, CatalogAnime];

function formatFamily(format: string): string {
  if (format === 'TV' || format === 'TV Short' || format === 'ONA') return 'series';
  if (format === 'OVA' || format === 'Special') return 'ova';
  return format === 'Movie' ? 'movie' : 'other';
}

function sharesSong(anime: CatalogAnime, song: AnswerSong): boolean {
  return (song.id !== null && anime.songIds.has(song.id)) || (song.key !== null && anime.songKeys.has(song.key));
}

function optionsSoFar(context: Context): CatalogAnime[] {
  return [context.answer, ...context.chosen];
}

function fits(candidate: CatalogAnime, context: Context): boolean {
  const options = optionsSoFar(context);
  return (
    !options.includes(candidate) &&
    !sharesSong(candidate, context.song) &&
    options.every((option) => canShareOptions(option, candidate))
  );
}

function newFranchise(candidate: CatalogAnime, context: Context): boolean {
  return optionsSoFar(context).every((option) => option.franchiseId !== candidate.franchiseId);
}

// An era rule needs both years; without one, the anime only matches levels that have no era rule.
function withinEra(candidate: CatalogAnime, answer: CatalogAnime, era: number | null): boolean {
  if (era === null) return true;
  return candidate.year !== null && answer.year !== null && Math.abs(candidate.year - answer.year) <= era;
}

function matchesLevel(candidate: CatalogAnime, answer: CatalogAnime, level: Level): boolean {
  if (Math.abs(candidate.popularityPct - answer.popularityPct) > level.band) return false;
  if (!withinEra(candidate, answer, level.era)) return false;
  if (level.sharedGenre && ![...candidate.genres].some((genre) => answer.genres.has(genre))) return false;
  return !level.sameFormatFamily || formatFamily(candidate.format) === formatFamily(answer.format);
}

function candidatesAt(step: Step, context: Context, wanted: (anime: CatalogAnime) => boolean): CatalogAnime[] {
  return step.pool.filter(
    (anime) => wanted(anime) && matchesLevel(anime, context.answer, step.level) && fits(anime, context),
  );
}

function firstCandidate(
  steps: Step[],
  context: Context,
  wanted: (anime: CatalogAnime) => boolean,
  random: Random,
): CatalogAnime | undefined {
  for (const step of steps) {
    const candidates = candidatesAt(step, context, wanted);
    if (candidates.length > 0) return pick(candidates, random);
  }
  return undefined;
}

function addSingles(steps: Step[], context: Context, random: Random): void {
  while (context.chosen.length < WRONG_OPTIONS) {
    const single = firstCandidate(steps, context, (anime) => newFranchise(anime, context), random);
    if (!single) return;
    context.chosen.push(single);
  }
}

// One entry per franchise: the pairs of its candidates that can share a question.
function pairsByFranchise(candidates: CatalogAnime[]): Pair[][] {
  const groups = new Map<number, CatalogAnime[]>();
  for (const anime of candidates) groups.set(anime.franchiseId, [...(groups.get(anime.franchiseId) ?? []), anime]);
  const pairsOf = (members: CatalogAnime[]) =>
    members.flatMap((first, index) =>
      members
        .slice(index + 1)
        .filter((second) => canShareOptions(first, second))
        .map((second): Pair => [first, second]),
    );
  return [...groups.values()].map(pairsOf).filter((pairs) => pairs.length > 0);
}

// Hard: another anime of the answer's franchise, plus two of one other franchise, so the answer's pair looks
// like any pair. The other franchise is drawn uniformly, as the answer's was.
function addPairs(steps: Step[], context: Context, random: Random): boolean {
  const sibling = firstCandidate(steps, context, (anime) => anime.franchiseId === context.answer.franchiseId, random);
  if (!sibling) return false;
  context.chosen.push(sibling);
  for (const step of steps) {
    const franchises = pairsByFranchise(candidatesAt(step, context, (anime) => newFranchise(anime, context)));
    if (franchises.length > 0) {
      context.chosen.push(...pick(pick(franchises, random), random));
      return true;
    }
  }
  context.chosen.pop();
  return false;
}

// Pairs only come from the lobby's anime: a pair member from outside the filters would give away which pair
// holds the answer. Single options fall back to the whole catalog when the lobby's anime run out.
export function pickDistractors(
  catalog: Catalog,
  answer: CatalogAnime,
  song: AnswerSong,
  difficulty: Difficulty,
  universe: CatalogAnime[],
  random: Random,
): CatalogAnime[] {
  const levels = LEVELS[difficulty === 'custom' ? 'normal' : difficulty];
  const stepsOver = (pools: CatalogAnime[][]) => pools.flatMap((pool) => levels.map((level) => ({ pool, level })));
  const context: Context = { answer, song, chosen: [] };
  if (difficulty !== 'hard' || !addPairs(stepsOver([universe]), context, random)) {
    addSingles(stepsOver([universe, catalog.playableAnime]), context, random);
  }
  if (context.chosen.length < WRONG_OPTIONS) {
    throw new Error('The catalog has too few anime to build four distinct options');
  }
  return context.chosen;
}
