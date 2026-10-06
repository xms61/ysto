import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_TIMING, gameView, startGame, step } from '../../server/game/engine.ts';
import type { Game, GameEffect, GameEvent, TimerName } from '../../server/game/engine.ts';
import { buildGame } from '../../server/game/questions.ts';
import { seededRandom } from '../../server/game/random.ts';
import type { RoundReveal, ServerMessage } from '../../shared/protocol.ts';
import { SCORING_PRESETS, scoreQuestion } from '../../shared/scoring.ts';
import type { Answer, ScoringRules, Standing as ScoreStanding } from '../../shared/scoring.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { settingsFor, syntheticCatalog } from './fixtures.ts';

const catalog = syntheticCatalog();
const PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

interface Sent {
  at: number;
  to: string[];
  message: ServerMessage;
}

// Runs a game on a fake clock: clip cuts finish at once (or fail when told), timers fire in order.
class Simulation {
  game: Game;
  now = 0;
  sent: Sent[] = [];
  expired: { clipToken: string; at: number }[] = [];
  finished = false;
  readonly failing: (index: number) => boolean;
  #timers: { name: TimerName; roundId: string; at: number }[] = [];
  #cuts: Extract<GameEffect, { type: 'cut-clip' }>[] = [];

  constructor(settings: LobbySettings, players = PLAYERS, away: string[] = [], failing = (_index: number) => false) {
    this.failing = failing;
    const questions = buildGame(catalog, settings, seededRandom(1));
    const { game, effects } = startGame({ id: 'g1', settings, questions, players, away });
    this.game = game;
    this.#apply(effects);
    this.#serveCuts();
  }

  event(event: GameEvent): void {
    const { game, effects } = step(this.game, event, this.now);
    this.game = game;
    this.#apply(effects);
    this.#serveCuts();
  }

  advanceTo(time: number): void {
    for (;;) {
      const due = this.#timers.filter((timer) => timer.at <= time).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.#timers.splice(this.#timers.indexOf(due), 1);
      this.now = Math.max(this.now, due.at);
      this.event({ type: 'timer', name: due.name, roundId: due.roundId });
    }
    this.now = Math.max(this.now, time);
  }

  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const found = this.sent.findLast((sent) => sent.message.type === type);
    assert.ok(found, `a ${type} message was sent`);
    return found.message as Extract<ServerMessage, { type: T }>;
  }

  count(type: ServerMessage['type']): number {
    return this.sent.filter((sent) => sent.message.type === type).length;
  }

  #apply(effects: GameEffect[]): void {
    for (const effect of effects) {
      if (effect.type === 'send') this.sent.push({ at: this.now, to: effect.to, message: effect.message });
      else if (effect.type === 'timer')
        this.#timers.push({ name: effect.name, roundId: effect.roundId, at: effect.at });
      else if (effect.type === 'cut-clip') this.#cuts.push(effect);
      else if (effect.type === 'expire-clip') this.expired.push({ clipToken: effect.clipToken, at: effect.at });
      else this.finished = true;
    }
  }

  #serveCuts(): void {
    for (let cut = this.#cuts.shift(); cut; cut = this.#cuts.shift()) {
      const { index, question } = cut;
      const event: GameEvent = this.failing(index)
        ? { type: 'clip-failed', index }
        : { type: 'clip-ready', index, question, clipToken: `clip-${index}` };
      const { game, effects } = step(this.game, event, this.now);
      this.game = game;
      this.#apply(effects);
    }
  }
}

function settings(overrides: Partial<LobbySettings> = {}): LobbySettings {
  return settingsFor(catalog, { songsPerGame: 5, sampleLengthSec: 10, ...overrides });
}

// Every connected participant reports the clip loaded.
function allReady(sim: Simulation, players = sim.game.participants): void {
  const { roundId } = sim.last('round:prepare');
  for (const playerId of players) sim.event({ type: 'ready', playerId, roundId, loaded: true });
}

interface Scripted {
  playerId: string;
  delayMs: number; // after startsAt
  correct: boolean;
}

function optionFor(sim: Simulation, correct: boolean): number {
  const index = sim.game.round?.question.correctIndex ?? 0;
  return correct ? index : (index + 1) % 4;
}

// Plays the current round with the scripted answers, then lets the reveal run out.
function playRound(sim: Simulation, answers: Scripted[]): RoundReveal {
  allReady(sim);
  const start = sim.last('round:start');
  for (const answer of [...answers].sort((a, b) => a.delayMs - b.delayMs)) {
    sim.advanceTo(start.startsAt + answer.delayMs);
    const option = optionFor(sim, answer.correct);
    sim.event({ type: 'answer', playerId: answer.playerId, roundId: start.roundId, option });
  }
  sim.advanceTo(start.endsAt + GAME_TIMING.graceMs);
  const reveal = sim.last('round:reveal');
  assert.equal(reveal.roundId, start.roundId);
  sim.advanceTo(sim.now + GAME_TIMING.revealMs);
  return reveal;
}

// The scoring table applied to the script: response times from the script alone, and in First correct only
// the answers that arrive up to the first correct one, which closes the round.
function expectedAwards(rules: ScoringRules, answers: Scripted[], standings: ScoreStanding[]) {
  const arrived = [...answers].sort((a, b) => a.delayMs - b.delayMs);
  const firstCorrect = arrived.find((answer) => answer.correct)?.delayMs;
  const counted =
    rules.mode === 'firstCorrect' && firstCorrect !== undefined
      ? arrived.filter((answer) => answer.delayMs <= firstCorrect)
      : arrived;
  const scored: Answer[] = counted.map(({ playerId, correct, delayMs }) => ({
    playerId,
    correct,
    responseMs: delayMs,
  }));
  return scoreQuestion(rules, 10_000, scored, standings);
}

// p8 skips the first round, p7 always misses, the others miss when (round + player) % 4 is 0.
function scriptFor(round: number): Scripted[] {
  return PLAYERS.flatMap((playerId, index) => {
    const k = index + 1;
    if (playerId === 'p8' && round === 0) return [];
    return [{ playerId, delayMs: 800 * k + 137 * round, correct: playerId !== 'p7' && (round + k) % 4 !== 0 }];
  });
}

for (const preset of ['classic', 'buzzer', 'chill'] as const) {
  test(`plays a full game with 8 players in ${preset} scoring, and the scores follow the scoring table`, () => {
    const rules = SCORING_PRESETS[preset];
    const sim = new Simulation(settings({ scoring: { ...rules } }));
    const standings = new Map(PLAYERS.map((playerId) => [playerId, { playerId, score: 0, streak: 0 }]));
    for (let round = 0; round < 5; round++) {
      const script = scriptFor(round);
      const expected = expectedAwards(rules, script, [...standings.values()]);
      const reveal = playRound(sim, script);
      for (const award of expected) {
        const pick = reveal.picks.find((candidate) => candidate.playerId === award.playerId);
        assert.equal(pick?.points, award.points, `round ${round + 1}, ${award.playerId}`);
        const previous = standings.get(award.playerId) ?? assert.fail();
        standings.set(award.playerId, { ...previous, score: previous.score + award.points, streak: award.streak });
      }
    }
    assert.ok(sim.finished);
    const results = sim.last('game:results').standings;
    assert.deepEqual(
      Object.fromEntries(results.map((result) => [result.playerId, result.score])),
      Object.fromEntries([...standings.values()].map((standing) => [standing.playerId, standing.score])),
    );
    const scores = results.map((result) => result.score);
    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => b - a),
      'results rank by score',
    );
  });
}

test('drops early, late, repeated, foreign and stale answers', () => {
  const sim = new Simulation(settings(), ['p1', 'p2', 'p3', 'p4']);
  allReady(sim);
  const start = sim.last('round:start');
  const answer = (playerId: string, roundId = start.roundId) =>
    sim.event({ type: 'answer', playerId, roundId, option: optionFor(sim, true) });
  sim.advanceTo(start.startsAt - 1);
  answer('p1');
  sim.advanceTo(start.startsAt + 500);
  answer('p2');
  answer('p2');
  answer('p3', 'g1.9');
  answer('stranger');
  // The close timer fires at endsAt + grace, so the last answer that counts arrives just before it.
  sim.advanceTo(start.endsAt + GAME_TIMING.graceMs - 1);
  answer('p3');
  sim.now = start.endsAt + GAME_TIMING.graceMs + 1;
  answer('p4');
  assert.deepEqual(sim.last('round:answered').playerIds, ['p2', 'p3']);
  sim.advanceTo(sim.now);
  const points = Object.fromEntries(sim.last('round:reveal').picks.map((pick) => [pick.playerId, pick.points]));
  assert.deepEqual(points, { p1: 0, p2: 975, p3: 500, p4: 0 });
});

test('starts a round when every connected player is ready, or when the barrier runs out', () => {
  const sim = new Simulation(settings(), ['p1', 'p2', 'p3'], ['p3']);
  const prepare = sim.last('round:prepare');
  assert.deepEqual([prepare.number, prepare.rounds], [1, 5]);
  sim.event({ type: 'ready', playerId: 'p1', roundId: prepare.roundId, loaded: true });
  assert.equal(sim.count('round:start'), 0);
  sim.now = 2000;
  sim.event({ type: 'ready', playerId: 'p2', roundId: prepare.roundId, loaded: false });
  const first = sim.last('round:start');
  assert.equal(first.startsAt, 2000 + GAME_TIMING.firstLeadMs, 'the first round counts down');
  assert.equal(first.endsAt, first.startsAt + 10_000);
  sim.advanceTo(first.endsAt + GAME_TIMING.graceMs);
  const reveal = sim.last('round:reveal');
  assert.deepEqual(
    reveal.picks.filter((pick) => pick.noAudio).map((pick) => pick.playerId),
    ['p2', 'p3'],
  );
  sim.advanceTo(sim.now + GAME_TIMING.revealMs);
  const second = sim.last('round:prepare');
  sim.event({ type: 'ready', playerId: 'p1', roundId: second.roundId, loaded: true });
  sim.advanceTo(sim.now + GAME_TIMING.barrierMs);
  assert.equal(
    sim.last('round:start').startsAt,
    sim.now + GAME_TIMING.leadMs,
    'later rounds start 1 s after the barrier',
  );
});

test('ends a round once everyone has answered, and in First correct on the first correct answer', () => {
  const everyone = new Simulation(settings(), ['p1', 'p2']);
  playRoundPartly(everyone, [
    { playerId: 'p1', delayMs: 1000, correct: false },
    { playerId: 'p2', delayMs: 2000, correct: true },
  ]);
  assert.equal(
    everyone.sent.findLast((sent) => sent.message.type === 'round:reveal')?.at,
    everyone.last('round:start').startsAt + 2000,
  );

  const buzzer = new Simulation(settings({ scoring: { ...SCORING_PRESETS.buzzer } }), ['p1', 'p2', 'p3']);
  playRoundPartly(buzzer, [
    { playerId: 'p1', delayMs: 1000, correct: true },
    { playerId: 'p2', delayMs: 1100, correct: true },
  ]);
  const start = buzzer.last('round:start');
  const reveal = buzzer.sent.findLast((sent) => sent.message.type === 'round:reveal');
  assert.equal(reveal?.at, start.startsAt + 1000);
  // p2 arrived after the round had closed on p1's answer; no allowance for the connection reorders them.
  const points = Object.fromEntries(buzzer.last('round:reveal').picks.map((pick) => [pick.playerId, pick.points]));
  assert.deepEqual(points, { p1: 1000, p2: 0, p3: 0 });
});

// Readies everyone and sends the answers, without running the round out.
function playRoundPartly(sim: Simulation, answers: Scripted[]): void {
  allReady(sim);
  const start = sim.last('round:start');
  for (const answer of answers) {
    sim.advanceTo(start.startsAt + answer.delayMs);
    const option = optionFor(sim, answer.correct);
    sim.event({ type: 'answer', playerId: answer.playerId, roundId: start.roundId, option });
  }
}

test('skips a round without points or broken streaks', () => {
  const sim = new Simulation(settings(), ['p1', 'p2']);
  playRound(sim, [{ playerId: 'p1', delayMs: 1000, correct: true }]);
  allReady(sim);
  sim.advanceTo(sim.last('round:start').startsAt + 500);
  sim.event({ type: 'skip' });
  const reveal = sim.last('round:reveal');
  assert.equal(reveal.skipped, true);
  assert.deepEqual(
    reveal.picks.map((pick) => pick.points),
    [0, 0],
  );
  assert.deepEqual(reveal.standings.find((standing) => standing.playerId === 'p1')?.streak, 1);
});

test('drops a round whose clip failed on every theme, and plays the rest', () => {
  const sim = new Simulation(settings(), ['p1'], [], (index) => index === 1);
  playRound(sim, []);
  const prepare = sim.last('round:prepare');
  assert.deepEqual([prepare.number, prepare.rounds], [2, 4]);
  for (let round = 0; round < 3; round++) playRound(sim, []);
  assert.ok(sim.finished);
  assert.equal(gameView(sim.game).rounds, 4);
  assert.equal(sim.game.playedThemeIds.length, 4);
});

test("lists the game's songs with the results, in the order they played, without dropped rounds", () => {
  const sim = new Simulation(settings(), ['p1'], [], (index) => index === 1);
  const reveals = [playRound(sim, [])];
  allReady(sim);
  sim.event({ type: 'skip' });
  reveals.push(sim.last('round:reveal'));
  sim.advanceTo(sim.now + GAME_TIMING.revealMs);
  assert.equal(gameView(sim.game).songs, null, 'no list before the game ends');
  for (let round = 0; round < 2; round++) reveals.push(playRound(sim, []));
  const songs = gameView(sim.game).songs ?? assert.fail();
  assert.deepEqual(
    songs.map((song) => [song.number, song.skipped, song.slug, song.song.title]),
    reveals.map((reveal, index) => [index + 1, index === 1, reveal.slug, reveal.song.title]),
  );
  assert.ok(songs.every((song) => !('cover' in song)));
});

test('names the players who picked each song right, only in the finished list', () => {
  const sim = new Simulation(settings({ songsPerGame: 2 }), ['p1', 'p2']);
  playRound(sim, [
    { playerId: 'p1', delayMs: 1000, correct: true },
    { playerId: 'p2', delayMs: 1200, correct: false },
  ]);
  playRound(sim, [
    { playerId: 'p1', delayMs: 1000, correct: true },
    { playerId: 'p2', delayMs: 900, correct: true },
  ]);
  const songs = gameView(sim.game).songs ?? assert.fail();
  assert.deepEqual(
    songs.map((song) => [...song.right].sort()),
    [['p1'], ['p1', 'p2']],
  );
});

test('lets a late joiner watch the round in progress, then play from the next one at 0 points', () => {
  const sim = new Simulation(settings(), ['p1']);
  allReady(sim);
  sim.advanceTo(sim.last('round:start').startsAt + 1000);
  sim.event({ type: 'player-joined', playerId: 'late' });
  sim.event({ type: 'player-connected', playerId: 'late' });
  const caughtUp = sim.sent
    .filter((sent) => sent.to.length === 1 && sent.to[0] === 'late')
    .map((sent) => sent.message.type);
  assert.deepEqual(caughtUp, ['round:prepare', 'round:start', 'round:answered']);
  sim.event({ type: 'answer', playerId: 'late', roundId: sim.last('round:start').roundId, option: 0 });
  sim.advanceTo(sim.last('round:start').endsAt + GAME_TIMING.graceMs);
  assert.deepEqual(
    sim.last('round:reveal').picks.map((pick) => pick.playerId),
    ['p1'],
    'the late joiner watches this round',
  );
  sim.advanceTo(sim.now + GAME_TIMING.revealMs);
  assert.deepEqual(sim.game.participants, ['p1', 'late']);
  assert.deepEqual(sim.last('round:prepare').number, 2);
  const reveal = playRound(sim, []);
  assert.deepEqual(
    reveal.standings.map((standing) => [standing.playerId, standing.score]),
    [
      ['p1', 0],
      ['late', 0],
    ],
  );
});

test('catches up a player who reconnects, and waits only for connected players', () => {
  const sim = new Simulation(settings(), ['p1', 'p2']);
  const { roundId } = sim.last('round:prepare');
  sim.event({ type: 'ready', playerId: 'p1', roundId, loaded: true });
  sim.event({ type: 'player-disconnected', playerId: 'p2' });
  const start = sim.last('round:start');
  sim.advanceTo(start.startsAt + 100);
  sim.event({ type: 'player-connected', playerId: 'p2' });
  const toP2 = sim.sent.filter((sent) => sent.to.join() === 'p2').map((sent) => sent.message.type);
  assert.deepEqual(toP2, ['round:prepare', 'round:start', 'round:answered']);
  sim.event({ type: 'answer', playerId: 'p1', roundId: start.roundId, option: 0 });
  sim.event({ type: 'answer', playerId: 'p2', roundId: start.roundId, option: 0 });
  sim.event({ type: 'player-disconnected', playerId: 'p2' });
  sim.event({ type: 'player-connected', playerId: 'p2' });
  assert.equal(sim.sent.at(-1)?.message.type, 'round:reveal', 'a reconnect during the reveal gets the reveal again');
});

test('closes a round at once when the only player still to answer drops or leaves', () => {
  for (const change of ['player-disconnected', 'player-left'] as const) {
    const sim = new Simulation(settings(), ['p1', 'p2', 'p3']);
    playRoundPartly(sim, [
      { playerId: 'p1', delayMs: 1000, correct: true },
      { playerId: 'p2', delayMs: 2000, correct: false },
    ]);
    assert.equal(sim.count('round:reveal'), 0);
    sim.event({ type: change, playerId: 'p3' });
    assert.equal(sim.count('round:reveal'), 1, change);
  }
});

test('ends the game when nobody is connected at the barrier, or the last player leaves', () => {
  const abandoned = new Simulation(settings(), ['p1'], ['p1']);
  abandoned.advanceTo(GAME_TIMING.barrierMs);
  assert.ok(abandoned.finished);
  const emptied = new Simulation(settings(), ['p1']);
  emptied.event({ type: 'player-left', playerId: 'p1' });
  assert.ok(emptied.finished);
});

test('expires each clip token 10 s after its reveal ends', () => {
  const sim = new Simulation(settings(), ['p1']);
  playRound(sim, []);
  const revealAt = sim.sent.find((sent) => sent.message.type === 'round:reveal')?.at ?? assert.fail();
  assert.deepEqual(sim.expired[0], {
    clipToken: 'clip-0',
    at: revealAt + GAME_TIMING.revealMs + GAME_TIMING.clipLingerMs,
  });
});

test('ranks the results and reports correct answers, average time and best streak', () => {
  const sim = new Simulation(settings(), ['p1', 'p2']);
  const rounds: Scripted[][] = [
    [{ playerId: 'p1', delayMs: 1000, correct: true }],
    [
      { playerId: 'p1', delayMs: 3000, correct: true },
      { playerId: 'p2', delayMs: 500, correct: true },
    ],
    [{ playerId: 'p2', delayMs: 700, correct: false }],
    [],
    [],
  ];
  assert.equal(gameView(sim.game).results, null, 'no results while the game runs');
  for (const answers of rounds) playRound(sim, answers);
  const standings = sim.last('game:results').standings;
  assert.deepEqual(standings, [
    { playerId: 'p1', score: 950 + 850 + 100, correct: 2, averageMs: 2000, bestStreak: 2 },
    { playerId: 'p2', score: 975, correct: 1, averageMs: 500, bestStreak: 1 },
  ]);
  assert.deepEqual(gameView(sim.game).results, standings, 'the game view keeps the results for reconnects');
});

test('leaks nothing about the answer before its reveal', () => {
  const sim = new Simulation(settings(), PLAYERS.slice(0, 3));
  for (let round = 0; round < 5; round++) {
    const from = sim.sent.length;
    const question = sim.game.round?.question ?? assert.fail();
    playRound(sim, scriptFor(round).slice(0, 3));
    const revealAt = sim.sent.findIndex((sent, index) => index >= from && sent.message.type === 'round:reveal');
    const before = sim.sent.slice(from, revealAt).map((sent) => sent.message);
    const { anime, song } = question.reveal;
    const secrets = [
      anime.english,
      anime.romaji,
      anime.japanese,
      song.title,
      ...song.artists.map((artist) => artist.name),
    ];
    for (const message of before) {
      const { options, ...rest } = message as ServerMessage & { options?: unknown };
      const text = JSON.stringify(rest);
      for (const secret of secrets)
        if (secret) assert.equal(text.includes(secret), false, `${message.type} holds ${secret}`);
      for (const key of ['animeId', 'themeId', 'relPath', 'correct', 'songId'])
        assert.equal(text.includes(`"${key}"`), false);
      if (options) assert.equal(Object.keys(options).length, 3, 'options are only the three title lists');
    }
  }
});

const SWITCHING = { answerChanges: true, overtimeSec: 5 } as const;

function pointsOf(reveal: RoundReveal): Record<string, number> {
  return Object.fromEntries(reveal.picks.map((pick) => [pick.playerId, pick.points]));
}

test('with answer changes on, a switch replaces the pick at its own time, and the others hear only who switched', () => {
  const sim = new Simulation(settings(SWITCHING), ['p1', 'p2', 'p3']);
  allReady(sim);
  const start = sim.last('round:start');
  const answer = (playerId: string, correct: boolean) =>
    sim.event({ type: 'answer', playerId, roundId: start.roundId, option: optionFor(sim, correct) });
  sim.advanceTo(start.startsAt + 1000);
  answer('p1', false);
  sim.advanceTo(start.startsAt + 3000);
  answer('p1', true);
  answer('p1', true);
  const switched = sim.sent.filter((sent) => sent.message.type === 'round:switched');
  assert.equal(switched.length, 1, 'picking the same option again is no switch');
  assert.deepEqual(switched[0]?.to, ['p2', 'p3']);
  assert.deepEqual(switched[0]?.message, { type: 'round:switched', roundId: start.roundId, playerId: 'p1' });
  assert.deepEqual(sim.last('round:answered').playerIds, ['p1']);
  sim.advanceTo(start.endsAt + GAME_TIMING.graceMs);
  const reveal = sim.last('round:reveal');
  assert.equal(reveal.picks.find((pick) => pick.playerId === 'p1')?.option, optionFor(sim, true));
  // Speed scores the switch's time: 3 s of a 10 s window.
  assert.deepEqual(pointsOf(reveal), { p1: 850, p2: 0, p3: 0 });
});

test('runs an overtime once everyone has answered, open to switches, and never past the clip', () => {
  const sim = new Simulation(settings(SWITCHING), ['p1', 'p2']);
  playRoundPartly(sim, [
    { playerId: 'p1', delayMs: 1000, correct: false },
    { playerId: 'p2', delayMs: 2000, correct: true },
  ]);
  const start = sim.last('round:start');
  const overtime = sim.last('round:overtime');
  assert.deepEqual(overtime, {
    type: 'round:overtime',
    roundId: start.roundId,
    startsAt: start.startsAt + 2000,
    endsAt: start.startsAt + 7000,
  });
  assert.equal(sim.count('round:reveal'), 0);
  sim.advanceTo(start.startsAt + 6000);
  sim.event({ type: 'answer', playerId: 'p1', roundId: start.roundId, option: optionFor(sim, true) });
  sim.advanceTo(overtime.endsAt + GAME_TIMING.graceMs - 1);
  assert.equal(sim.count('round:reveal'), 0);
  sim.advanceTo(overtime.endsAt + GAME_TIMING.graceMs);
  assert.deepEqual(pointsOf(sim.last('round:reveal')), { p1: 700, p2: 900 });
  assert.equal(sim.count('round:overtime'), 1, 'a switch never restarts the overtime');

  const late = new Simulation(settings(SWITCHING), ['p1', 'p2']);
  playRoundPartly(late, [
    { playerId: 'p1', delayMs: 1000, correct: true },
    { playerId: 'p2', delayMs: 8000, correct: true },
  ]);
  const lateStart = late.last('round:start');
  assert.equal(late.last('round:overtime').endsAt, lateStart.endsAt);
});

test('First correct keeps the first answer, even with answer changes on', () => {
  const buzzer = { ...SWITCHING, scoring: { ...SCORING_PRESETS.buzzer } };
  const sim = new Simulation(settings(buzzer), ['p1', 'p2']);
  playRoundPartly(sim, [
    { playerId: 'p1', delayMs: 1000, correct: false },
    { playerId: 'p1', delayMs: 2000, correct: true },
  ]);
  assert.equal(sim.count('round:switched'), 0);
  sim.event({
    type: 'answer',
    playerId: 'p2',
    roundId: sim.last('round:start').roundId,
    option: optionFor(sim, false),
  });
  assert.equal(sim.count('round:overtime'), 0);
  assert.deepEqual(pointsOf(sim.last('round:reveal')), { p1: -500, p2: -500 });
});

test('starts the overtime when the last player to answer drops, and catches up a returning player with it', () => {
  const sim = new Simulation(settings(SWITCHING), ['p1', 'p2', 'p3']);
  playRoundPartly(sim, [
    { playerId: 'p1', delayMs: 1000, correct: true },
    { playerId: 'p2', delayMs: 2000, correct: false },
  ]);
  assert.equal(sim.count('round:overtime'), 0);
  sim.event({ type: 'player-disconnected', playerId: 'p3' });
  assert.equal(sim.count('round:overtime'), 1);
  sim.event({ type: 'player-disconnected', playerId: 'p2' });
  sim.event({ type: 'player-connected', playerId: 'p2' });
  const toP2 = sim.sent.filter((sent) => sent.to.join() === 'p2').map((sent) => sent.message);
  assert.deepEqual(
    toP2.map((message) => message.type),
    ['round:prepare', 'round:start', 'round:answered', 'round:overtime', 'round:pick'],
  );
  assert.deepEqual(toP2.at(-1), {
    type: 'round:pick',
    roundId: sim.last('round:start').roundId,
    option: optionFor(sim, false),
  });
});
