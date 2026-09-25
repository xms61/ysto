import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankPlayers, SCORING_PRESETS, scoreQuestion } from '../../shared/scoring.ts';
import type { Answer, ScoringRules, Standing } from '../../shared/scoring.ts';

const WINDOW_MS = 20_000;
const plain: ScoringRules = { mode: 'speed', streakBonus: false, comeback: false, wrongAnswerPenalty: false };

function answer(playerId: string, correct: boolean, responseMs = 0): Answer {
  return { playerId, correct, responseMs };
}

function standing(playerId: string, score = 0, streak = 0): Standing {
  return { playerId, score, streak };
}

// Points for one player who answers alone, from a standing of 0 points and the given streak.
function pointsFor(rules: ScoringRules, given: Answer | null, streak = 0): number {
  const [award] = scoreQuestion(rules, WINDOW_MS, given ? [given] : [], [standing('a', 0, streak)]);
  assert.ok(award);
  return award.points;
}

const cases: { name: string; rules: ScoringRules; answer: Answer | null; streak?: number; points: number }[] = [
  { name: 'Speed, instant', rules: plain, answer: answer('a', true, 0), points: 1000 },
  { name: 'Speed, half the window', rules: plain, answer: answer('a', true, 10_000), points: 750 },
  { name: 'Speed, at the deadline', rules: plain, answer: answer('a', true, 20_000), points: 500 },
  { name: 'Speed, rounded', rules: plain, answer: answer('a', true, 333), points: 992 },
  { name: 'Speed, a late time counts as the deadline', rules: plain, answer: answer('a', true, 25_000), points: 500 },
  { name: 'Speed, a negative time counts as instant', rules: plain, answer: answer('a', true, -5), points: 1000 },
  { name: 'Flat, any time', rules: { ...plain, mode: 'flat' }, answer: answer('a', true, 19_000), points: 1000 },
  {
    name: 'First correct, alone',
    rules: { ...plain, mode: 'firstCorrect' },
    answer: answer('a', true, 9000),
    points: 1000,
  },
  { name: 'wrong, no penalty', rules: plain, answer: answer('a', false), points: 0 },
  { name: 'wrong, penalty', rules: { ...plain, wrongAnswerPenalty: true }, answer: answer('a', false), points: -250 },
  {
    name: 'wrong, penalty in Flat',
    rules: { ...SCORING_PRESETS.chill, wrongAnswerPenalty: true },
    answer: answer('a', false),
    points: -250,
  },
  { name: 'wrong, First correct penalty', rules: SCORING_PRESETS.buzzer, answer: answer('a', false), points: -500 },
  { name: 'no answer, even with a penalty', rules: SCORING_PRESETS.buzzer, answer: null, points: 0 },
  {
    name: 'streak, first correct answer',
    rules: SCORING_PRESETS.classic,
    answer: answer('a', true),
    streak: 0,
    points: 1000,
  },
  { name: 'streak of 2', rules: SCORING_PRESETS.classic, answer: answer('a', true), streak: 1, points: 1100 },
  { name: 'streak of 3', rules: SCORING_PRESETS.classic, answer: answer('a', true), streak: 2, points: 1200 },
  {
    name: 'streak of 6 reaches the cap',
    rules: SCORING_PRESETS.classic,
    answer: answer('a', true),
    streak: 5,
    points: 1500,
  },
  {
    name: 'streak of 10 stays at the cap',
    rules: SCORING_PRESETS.classic,
    answer: answer('a', true),
    streak: 9,
    points: 1500,
  },
  { name: 'streak bonus off', rules: plain, answer: answer('a', true), streak: 4, points: 1000 },
  {
    name: 'streak with a penalty lost on a wrong answer',
    rules: { ...SCORING_PRESETS.classic, wrongAnswerPenalty: true },
    answer: answer('a', false),
    streak: 4,
    points: -250,
  },
];

for (const scoringCase of cases) {
  test(`scores ${scoringCase.name}`, () => {
    const points = pointsFor(scoringCase.rules, scoringCase.answer, scoringCase.streak);
    assert.ok(Object.is(points, scoringCase.points), `${points} points, expected ${scoringCase.points}`);
  });
}

test('gives First correct to the fastest correct answer, and exact ties to the earlier arrival', () => {
  const rules = { ...SCORING_PRESETS.buzzer, streakBonus: true };
  const answers = [
    answer('slow', true, 4000),
    answer('wrong', false, 500),
    answer('tieFirst', true, 1500),
    answer('tieSecond', true, 1500),
  ];
  const standings = ['slow', 'wrong', 'tieFirst', 'tieSecond', 'silent'].map((id) => standing(id, 0, 3));
  assert.deepEqual(scoreQuestion(rules, WINDOW_MS, answers, standings), [
    // A correct answer that doesn't win keeps its streak going, but a streak bonus needs base points.
    { playerId: 'slow', points: 0, streak: 4 },
    { playerId: 'wrong', points: -500, streak: 0 },
    { playerId: 'tieFirst', points: 1300, streak: 4 },
    { playerId: 'tieSecond', points: 0, streak: 4 },
    { playerId: 'silent', points: 0, streak: 0 },
  ]);
});

test('doubles the streak bonus of players behind the leader when comeback is on', () => {
  const rules = { ...SCORING_PRESETS.chill, streakBonus: true, comeback: true };
  const standings = [standing('leader', 5000, 2), standing('level', 5000, 2), standing('behind', 3000, 2)];
  const answers = standings.map((entry) => answer(entry.playerId, true));
  assert.deepEqual(
    scoreQuestion(rules, WINDOW_MS, answers, standings).map((award) => award.points),
    [1200, 1200, 1400],
  );
  const without = scoreQuestion({ ...rules, comeback: false }, WINDOW_MS, answers, standings);
  assert.deepEqual(
    without.map((award) => award.points),
    [1200, 1200, 1200],
  );
});

test('makes blind guessing lose points on average in Buzzer', () => {
  const win = pointsFor(SCORING_PRESETS.buzzer, answer('a', true));
  const miss = pointsFor(SCORING_PRESETS.buzzer, answer('a', false));
  assert.equal(0.25 * win + 0.75 * miss, -125);
});

test('defines the presets of the spec', () => {
  assert.deepEqual(SCORING_PRESETS, {
    classic: { mode: 'speed', streakBonus: true, comeback: false, wrongAnswerPenalty: false },
    buzzer: { mode: 'firstCorrect', streakBonus: false, comeback: false, wrongAnswerPenalty: true },
    chill: { mode: 'flat', streakBonus: false, comeback: false, wrongAnswerPenalty: false },
  });
});

test('ranks by score, then by less total time on correct answers, without reordering the input', () => {
  const tallies = [
    { playerId: 'slow', score: 3000, correctResponseMs: 9000 },
    { playerId: 'top', score: 4000, correctResponseMs: 20_000 },
    { playerId: 'fast', score: 3000, correctResponseMs: 4000 },
    { playerId: 'negative', score: -500, correctResponseMs: 0 },
  ];
  assert.deepEqual(
    rankPlayers(tallies).map((tally) => tally.playerId),
    ['top', 'fast', 'slow', 'negative'],
  );
  assert.equal(tallies[0]?.playerId, 'slow');
});
