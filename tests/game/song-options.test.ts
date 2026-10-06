import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Catalog, CatalogTheme } from '../../server/catalog/load.ts';
import { eligibleThemes } from '../../server/game/pool.ts';
import { buildGame } from '../../server/game/questions.ts';
import type { Question } from '../../server/game/questions.ts';
import { seededRandom } from '../../server/game/random.ts';
import { creditOf } from '../../server/game/song-options.ts';
import { normalizeTitle } from '../../server/game/titles.ts';
import { DIFFICULTIES, TITLE_LANGUAGES } from '../../shared/settings.ts';
import { settingsFor, syntheticCatalog } from './fixtures.ts';

const QUESTIONS_PER_KIND = 2000;

// The synthetic catalog with the overlaps the real one has: song titles shared between anime, artists who sing for
// several anime, and duets.
function overlappingCatalog(): Catalog {
  const base = syntheticCatalog();
  const themes = base.themes.map((theme): CatalogTheme => ({
    ...theme,
    songTitle: `Song ${theme.animeId % 70}`,
    artists:
      theme.animeId % 3 === 0
        ? [
            { name: `Artist ${theme.animeId % 40}`, as: null },
            { name: `Artist ${(theme.animeId + 7) % 40}`, as: null },
          ]
        : [{ name: `Artist ${theme.animeId % 40}`, as: null }],
  }));
  return { ...base, themes };
}

const catalog = overlappingCatalog();
const themeById = new Map(catalog.themes.map((theme) => [theme.id, theme]));

function questionsFor(ask: 'song' | 'artist', difficulty: (typeof DIFFICULTIES)[number]): Question[] {
  const settings = settingsFor(catalog, { questions: ask, difficulty, songsPerGame: 20 });
  const random = seededRandom(7);
  const questions: Question[] = [];
  while (questions.length < QUESTIONS_PER_KIND / DIFFICULTIES.length)
    questions.push(...buildGame(catalog, settings, random));
  return questions;
}

for (const ask of ['song', 'artist'] as const) {
  test(`builds ${ask} questions with four distinct options, one right, no shared song or franchise tell`, () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of questionsFor(ask, difficulty)) {
        assert.equal(question.ask, ask);
        const answer = themeById.get(question.themeId);
        assert.ok(answer);
        const texts = question.options.titles.english;
        for (const language of TITLE_LANGUAGES) assert.deepEqual(question.options.titles[language], texts);
        assert.equal(new Set(texts.map(normalizeTitle)).size, 4, `four distinct options: ${texts.join(' | ')}`);
        const right = ask === 'song' ? answer.songTitle : creditOf(answer);
        assert.equal(texts[question.correctIndex], right);
        const franchises = question.options.animeIds.map((id) => catalog.anime.get(id)?.franchiseId);
        assert.equal(new Set(franchises).size, 4, 'four franchises');
        if (ask === 'artist') {
          const names = texts.flatMap((text) => text.split(', ').map(normalizeTitle));
          assert.equal(new Set(names).size, names.length, `no artist on two options: ${texts.join(' | ')}`);
        }
      }
    }
  });
}

test('a mixed game asks each kind, and only kinds its theme can answer', () => {
  const settings = settingsFor(catalog, { questions: 'mixed', songsPerGame: 20 });
  const random = seededRandom(3);
  const asked = new Set<string>();
  for (let game = 0; game < 10; game++)
    for (const question of buildGame(catalog, settings, random)) asked.add(question.ask);
  assert.deepEqual([...asked].sort(), ['anime', 'artist', 'song']);
});

test('song title and artist games only draw themes that have a title or artists', () => {
  const base = syntheticCatalog();
  const themes = base.themes.map((theme, index) =>
    index % 2 === 0 ? { ...theme, songTitle: null, artists: [] } : theme,
  );
  const sparse = { ...base, themes };
  const all = eligibleThemes(sparse, settingsFor(sparse)).length;
  const withTitles = eligibleThemes(sparse, settingsFor(sparse, { questions: 'song' }));
  const withArtists = eligibleThemes(sparse, settingsFor(sparse, { questions: 'artist' }));
  assert.ok(withTitles.length < all && withTitles.every((theme) => theme.songTitle !== null));
  assert.ok(withArtists.length < all && withArtists.every((theme) => theme.artists.length > 0));
});
