import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareClip, THEMES_PER_ROUND } from '../../server/clips/prepare.ts';
import { buildGame, replacementQuestion } from '../../server/game/questions.ts';
import type { Question } from '../../server/game/questions.ts';
import { seededRandom } from '../../server/game/random.ts';
import { animeEntry, catalogOf, settingsFor, themeEntry } from '../game/fixtures.ts';

const catalog = catalogOf(
  [1, 2, 3, 4, 5, 6, 7, 8].map((id) => animeEntry(id)),
  [1, 2, 3, 4, 5, 6, 7, 8].map((id) => themeEntry(id, id)),
);
const settings = settingsFor(catalog, { songsPerGame: 5 });

// A five-round game, a cutter whose first cuts fail, and the replace step a game passes in.
function setUp(failingCuts: number) {
  const random = seededRandom(3);
  const game = buildGame(catalog, settings, random);
  const cuts: Question['clip'][] = [];
  const log: string[] = [];
  const deps = {
    cut: async (clip: Question['clip']) => {
      cuts.push(clip);
      if (cuts.length <= failingCuts) throw new Error('ffmpeg exited with code 1');
      return Buffer.from(clip.relPath);
    },
    replace: (tried: readonly Question[]) => replacementQuestion(catalog, settings, random, [...game, ...tried]),
    log: (line: string) => log.push(line),
  };
  const [first] = game;
  assert.ok(first);
  return { game, first, cuts, log, deps };
}

test('cuts the clip of the question it was given', async () => {
  const { first, log, deps } = setUp(0);
  const prepared = await prepareClip(first, deps);
  assert.equal(prepared.question, first);
  assert.deepEqual(prepared.audio, Buffer.from(first.clip.relPath));
  assert.deepEqual(log, []);
});

test('moves the round to another theme when a cut fails, and logs the failure once', async () => {
  const { game, first, cuts, log, deps } = setUp(1);
  const prepared = await prepareClip(first, deps);
  assert.ok(!game.some((question) => question.animeId === prepared.question.animeId), 'an anime the game lacks');
  assert.deepEqual(cuts, [first.clip, prepared.question.clip]);
  assert.deepEqual(log, [`Clip for theme ${first.themeId} failed (1 of 3): ffmpeg exited with code 1`]);
});

test(`gives up after ${THEMES_PER_ROUND} themes, each from another anime`, async () => {
  const { first, cuts, log, deps } = setUp(Infinity);
  await assert.rejects(prepareClip(first, deps), /No clip after 3 themes/);
  assert.equal(new Set(cuts.map((clip) => clip.relPath)).size, THEMES_PER_ROUND);
  assert.equal(log.length, THEMES_PER_ROUND);
});
