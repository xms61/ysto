import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Catalog, CatalogAnime } from '../../server/catalog/load.ts';
import { eligibleThemes, LEAD_IN_MS, optionUniverse, TAIL_MS } from '../../server/game/pool.ts';
import { buildGame } from '../../server/game/questions.ts';
import type { Question } from '../../server/game/questions.ts';
import { seededRandom } from '../../server/game/random.ts';
import { canShareOptions, normalizeTitle } from '../../server/game/titles.ts';
import { DIFFICULTIES, TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { animeEntry, catalogOf, settingsFor, syntheticCatalog, themeEntry } from './fixtures.ts';

const QUESTIONS_PER_DIFFICULTY = 10_000;
// Chi-square critical value for 3 degrees of freedom at p = 0.001.
const CHI_SQUARE_LIMIT = 16.27;
const catalog = syntheticCatalog();

interface Song {
  id: number | null;
  key: string | null;
}

interface Lobby {
  settings: LobbySettings;
  eligibleThemeIds: Set<number>;
  universe: CatalogAnime[];
  universeIds: Set<number>;
}

function lobbyFor(settings: LobbySettings): Lobby {
  const universe = optionUniverse(catalog, settings);
  return {
    settings,
    eligibleThemeIds: new Set(eligibleThemes(catalog, settings).map((theme) => theme.id)),
    universe,
    universeIds: new Set(universe.map((anime) => anime.id)),
  };
}

function gamesUntil(questions: number, settings: LobbySettings, seed: number): Question[][] {
  const random = seededRandom(seed);
  const games: Question[][] = [];
  for (let count = 0; count < questions; count += settings.songsPerGame)
    games.push(buildGame(catalog, settings, random));
  return games;
}

function optionsOf(source: Catalog, question: Question): CatalogAnime[] {
  return question.options.animeIds.map((id) => {
    const anime = source.anime.get(id);
    assert.ok(anime, `anime ${id} is in the catalog`);
    return anime;
  });
}

function sharesSong(anime: CatalogAnime, song: Song): boolean {
  return (song.id !== null && anime.songIds.has(song.id)) || (song.key !== null && anime.songKeys.has(song.key));
}

// Franchise sizes among the options, largest first: "1+1+1+1" is four franchises, "2+2" two pairs.
function franchiseShape(options: CatalogAnime[]): string {
  const counts = new Map<number, number>();
  for (const anime of options) counts.set(anime.franchiseId, (counts.get(anime.franchiseId) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a).join('+');
}

function hasSiblingFor(answer: CatalogAnime, song: Song, universe: CatalogAnime[]): boolean {
  return universe.some(
    (anime) =>
      anime.franchiseId === answer.franchiseId &&
      anime.id !== answer.id &&
      !sharesSong(anime, song) &&
      canShareOptions(answer, anime),
  );
}

// Checks one question and returns its franchise shape.
function checkQuestion(question: Question, lobby: Lobby): string {
  const options = optionsOf(catalog, question);
  assert.equal(new Set(options).size, 4, 'four different anime');
  const answer = options[question.correctIndex];
  assert.ok(answer && answer.id === question.animeId, 'the correct index points at the answer');
  for (const language of TITLE_LANGUAGES) {
    const titles = question.options.titles[language];
    assert.equal(new Set(titles.map(normalizeTitle)).size, 4, `four distinct ${language} titles`);
  }
  const theme = catalog.themes.find((entry) => entry.id === question.themeId);
  assert.ok(theme && lobby.eligibleThemeIds.has(theme.id), 'the answer passes the lobby filters');
  const song = { id: theme.songId, key: theme.songKey };
  for (const anime of options) {
    assert.ok(anime === answer || !sharesSong(anime, song), 'no other option has the answer song');
    assert.ok(lobby.universeIds.has(anime.id), 'every option passes the lobby filters');
  }
  const shape = franchiseShape(options);
  const pairs = lobby.settings.difficulty === 'hard' && hasSiblingFor(answer, song, lobby.universe);
  assert.equal(shape, pairs ? '2+2' : '1+1+1+1', 'the franchises form no pattern that points at the answer');
  const latestStart = theme.durationMs - question.clip.lengthMs - TAIL_MS;
  assert.ok(question.clip.startMs >= LEAD_IN_MS && question.clip.startMs <= latestStart, 'offset in bounds');
  return shape;
}

for (const [index, difficulty] of DIFFICULTIES.entries()) {
  test(`builds ${QUESTIONS_PER_DIFFICULTY} fair ${difficulty} questions`, () => {
    // The year filter leaves out part of the catalog, so options and Hard's pairs must respect it.
    const lobby = lobbyFor(
      settingsFor(catalog, {
        difficulty,
        songsPerGame: 10,
        years: { from: 1990, to: 2030 },
        popularityRanks: { from: 1, to: 120 },
      }),
    );
    const positions = [0, 0, 0, 0];
    const shapes = new Set<string>();
    for (const game of gamesUntil(QUESTIONS_PER_DIFFICULTY, lobby.settings, 1000 + index)) {
      assert.equal(new Set(game.map((question) => question.animeId)).size, game.length, 'no anime twice in a game');
      for (const question of game) {
        shapes.add(checkQuestion(question, lobby));
        positions[question.correctIndex] = (positions[question.correctIndex] ?? 0) + 1;
      }
    }
    if (difficulty === 'hard') assert.deepEqual([...shapes].sort(), ['1+1+1+1', '2+2'], 'Hard builds both shapes');
    const expected = QUESTIONS_PER_DIFFICULTY / 4;
    const chiSquare = positions.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    assert.ok(
      chiSquare < CHI_SQUARE_LIMIT,
      `correct positions ${positions.join('/')} are uniform (chi-square ${chiSquare.toFixed(2)})`,
    );
  });
}

function tinyCatalog(): Catalog {
  const anime = [1, 2, 3, 4, 5, 6].map((id) => animeEntry(id, { popularityPct: id / 10 }));
  const themes = [1, 2, 3, 4, 5, 6].map((id) => themeEntry(id, id, { durationMs: 60_000 }));
  return catalogOf(anime, themes);
}

function catalogWith(anime: CatalogAnime[]): Catalog {
  return catalogOf(
    anime,
    anime.map((entry) => themeEntry(entry.id, entry.id)),
  );
}

test('starts intro samples at 0 s and keeps random ones clear of the lead-in and tail', () => {
  const tiny = tinyCatalog();
  const intro = buildGame(
    tiny,
    settingsFor(tiny, { songsPerGame: 5, sampleStart: 'intro', sampleLengthSec: 30 }),
    seededRandom(1),
  );
  assert.deepEqual(new Set(intro.map((question) => question.clip.startMs)), new Set([0]));
  const random = buildGame(tiny, settingsFor(tiny, { songsPerGame: 5, sampleLengthSec: 30 }), seededRandom(1));
  for (const question of random) {
    assert.ok(question.clip.startMs >= 3000 && question.clip.startMs <= 60_000 - 30_000 - 5000);
    assert.equal(question.clip.lengthMs, 30_000);
  }
});

test('avoids themes the lobby has played until too few anime remain', () => {
  const tiny = tinyCatalog();
  const settings = settingsFor(tiny, { songsPerGame: 5 });
  const fresh = buildGame(tiny, settings, seededRandom(3), new Set([1]));
  assert.equal(
    fresh.some((question) => question.themeId === 1),
    false,
  );
  const replay = buildGame(tiny, settings, seededRandom(3), new Set([1, 2, 3]));
  assert.equal(replay.length, 5, 'with only 3 anime unplayed, the game falls back to the whole pool');
});

test('refuses a game with more songs than matching anime', () => {
  const tiny = tinyCatalog();
  assert.throws(
    () => buildGame(tiny, settingsFor(tiny, { songsPerGame: 7 }), seededRandom(1)),
    /Only 6 anime match the settings; the game needs 7/,
  );
});

test('draws each franchise as often as any other, however many anime it has', () => {
  const big = Array.from({ length: 30 }, (_, index) => animeEntry(100 + index, { franchiseId: 100 }));
  const franchiseCatalog = catalogWith([...big, ...[1, 2, 3, 4, 5].map((id) => animeEntry(id))]);
  const random = seededRandom(9);
  let fromBig = 0;
  const rounds = 2000;
  for (let round = 0; round < rounds; round++) {
    const [question] = buildGame(
      franchiseCatalog,
      settingsFor(franchiseCatalog, { songsPerGame: 1, difficulty: 'hard' }),
      random,
    );
    if ((question?.animeId ?? 0) >= 100) fromBig++;
  }
  // 6 franchises, so the 30-anime franchise should open about a sixth of the games, not 30 of 35.
  assert.ok(Math.abs(fromBig / rounds - 1 / 6) < 0.03, `the big franchise opened ${fromBig} of ${rounds} games`);
});

test('pairs Hard options only from anime inside the lobby filters', () => {
  const pairCatalog = catalogWith([
    animeEntry(1, { year: 2010 }),
    animeEntry(2, { franchiseId: 1, year: 2000 }),
    animeEntry(10, { year: 2010 }),
    animeEntry(11, { franchiseId: 10, year: 2011 }),
    animeEntry(30, { year: 2012 }),
    animeEntry(31, { franchiseId: 30, year: 2013 }),
    ...[20, 21, 22, 23, 24].map((id) => animeEntry(id, { year: 2010 })),
  ]);
  const settings = settingsFor(pairCatalog, { difficulty: 'hard', songsPerGame: 10, years: { from: 2005, to: 2015 } });
  for (const seed of [1, 2, 3]) {
    for (const question of buildGame(pairCatalog, settings, seededRandom(seed))) {
      const options = optionsOf(pairCatalog, question);
      assert.ok(!options.some((anime) => anime.id === 2), 'anime 2 is outside the years, so it is never an option');
      // Anime 1's only sibling is outside the years, so its questions use four franchises.
      const paired = [10, 11, 30, 31].includes(question.animeId);
      assert.equal(franchiseShape(options), paired ? '2+2' : '1+1+1+1', `answer ${question.animeId}`);
    }
  }
});

test('builds Hard options from four franchises when no other franchise can pair', () => {
  const lonely = catalogWith([
    animeEntry(1),
    animeEntry(2, { franchiseId: 1 }),
    ...[3, 4, 5, 6].map((id) => animeEntry(id)),
  ]);
  const game = buildGame(lonely, settingsFor(lonely, { difficulty: 'hard', songsPerGame: 6 }), seededRandom(4));
  for (const question of game) assert.equal(franchiseShape(optionsOf(lonely, question)), '1+1+1+1');
});

test('leaves the lobby filters only for the options its anime cannot fill', () => {
  // Inside the years: franchises 1 (two anime) and 3. The others are older.
  const narrow = catalogWith([
    animeEntry(1),
    animeEntry(2, { franchiseId: 1 }),
    animeEntry(3),
    ...[40, 41, 42].map((id) => animeEntry(id, { year: 1990 })),
  ]);
  const settings = settingsFor(narrow, { difficulty: 'normal', songsPerGame: 1, years: { from: 2005, to: 2015 } });
  for (let seed = 1; seed <= 20; seed++) {
    const [question] = buildGame(narrow, settings, seededRandom(seed));
    assert.ok(question);
    const options = optionsOf(narrow, question);
    assert.equal(franchiseShape(options), '1+1+1+1');
    assert.equal(options.filter((anime) => anime.year === 1990).length, 2, 'two options from outside the years');
  }
});

test('refuses to build options when the catalog has fewer than four franchises', () => {
  const small = catalogWith([
    animeEntry(1),
    animeEntry(2, { franchiseId: 1 }),
    animeEntry(3),
    animeEntry(4, { franchiseId: 3 }),
    animeEntry(5),
  ]);
  assert.throws(
    () => buildGame(small, settingsFor(small, { songsPerGame: 5 }), seededRandom(1)),
    /The catalog has too few anime to build four distinct options/,
  );
});
