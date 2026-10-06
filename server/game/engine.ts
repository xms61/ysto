// A game's rounds as a pure state machine (docs/product-specs/game-flow.md). `step` takes the game, an event
// and the time, and returns the next game and the effects for the shell to run: messages, timers, clip cuts
// and clip expiries. Nothing here reads a clock, a socket or a file, so a fake clock can drive whole games.
import type { GameView, Pick, PlayedSong, ResultView, ServerMessage, StandingView } from '../../shared/protocol.ts';
import { rankPlayers, scoreQuestion } from '../../shared/scoring.ts';
import type { Answer } from '../../shared/scoring.ts';
import { answersCanChange } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import type { Question } from './questions.ts';

export const GAME_TIMING = {
  barrierMs: 8000, // the ready barrier waits at most this long for the players' clips
  firstLeadMs: 3000, // from the barrier to the first sample: the game's countdown
  leadMs: 1000, // from the barrier to a later sample, so every client has round:start in time
  graceMs: 300, // answers still count this long after endsAt
  maxRttCompensationMs: 150, // at most this much of a player's round trip is taken off their time
  revealMs: 7000,
  clipLingerMs: 10_000, // a clip token lives this long after its reveal ends
} as const;

export type TimerName = 'barrier' | 'close' | 'reveal';

export interface Standing {
  score: number;
  streak: number;
  correct: number;
  correctMs: number; // total response time of correct answers
  bestStreak: number;
}

interface AnswerRecord {
  playerId: string;
  option: number;
  correct: boolean;
  responseMs: number;
}

export interface Round {
  id: string;
  question: Question;
  clipToken: string;
  phase: 'preparing' | 'playing' | 'revealing';
  ready: string[];
  noAudio: string[];
  startsAt: number;
  endsAt: number;
  closeAt: number; // the earliest close timer set so far
  overtime: { startsAt: number; endsAt: number } | null; // with answer changes on, once everyone has answered
  answers: AnswerRecord[]; // in arrival order; a switch replaces the player's record in place
  reveal: ServerMessage | null; // kept for players who reconnect during the reveal
}

export type PreparedClip = { question: Question; clipToken: string } | 'failed';

export interface Game {
  id: string;
  settings: LobbySettings;
  questions: Question[];
  players: string[]; // everyone in the lobby
  away: string[]; // players without a connection
  participants: string[]; // players in the rounds; a late joiner becomes one at the next round
  standings: Record<string, Standing>;
  round: Round | null; // null between rounds, while the next clip is being cut
  nextIndex: number; // the question the next round plays
  clips: Record<number, PreparedClip>; // by question index
  cutsRequested: number[];
  played: number; // rounds begun
  dropped: number; // rounds whose clip failed on every theme
  playedThemeIds: number[];
  songs: PlayedSong[]; // each closed round's song, for the results
  finished: boolean;
}

type ClipEvent =
  { type: 'clip-ready'; index: number; question: Question; clipToken: string } | { type: 'clip-failed'; index: number };
type ReadyEvent = { type: 'ready'; playerId: string; roundId: string; loaded: boolean };
type AnswerEvent = { type: 'answer'; playerId: string; roundId: string; option: number; rttMs: number };
type TimerEvent = { type: 'timer'; name: TimerName; roundId: string };
type PlayerEvent = {
  type: 'player-joined' | 'player-connected' | 'player-disconnected' | 'player-left';
  playerId: string;
};
export type GameEvent = ClipEvent | ReadyEvent | AnswerEvent | TimerEvent | { type: 'skip' } | PlayerEvent;

export type GameEffect =
  | { type: 'send'; to: string[]; message: ServerMessage }
  | { type: 'timer'; name: TimerName; roundId: string; at: number }
  | { type: 'cut-clip'; index: number; question: Question }
  | { type: 'expire-clip'; clipToken: string; at: number }
  | { type: 'finished' };

export interface Step {
  game: Game;
  effects: GameEffect[];
}

const EMPTY_STANDING: Standing = { score: 0, streak: 0, correct: 0, correctMs: 0, bestStreak: 0 };

// A draft of the game that one event may change, and the effects it produces.
interface Draft {
  game: Game;
  effects: GameEffect[];
  now: number;
}

function send(draft: Draft, message: ServerMessage, to: string[] = draft.game.players): void {
  draft.effects.push({ type: 'send', to: [...to], message });
}

function connected(game: Game, ids: string[]): string[] {
  return ids.filter((id) => !game.away.includes(id));
}

function rounds(game: Game): number {
  return game.questions.length - game.dropped;
}

function requestCut(draft: Draft, index: number): void {
  const { game } = draft;
  const question = game.questions[index];
  if (!question || game.cutsRequested.includes(index)) return;
  game.cutsRequested.push(index);
  draft.effects.push({ type: 'cut-clip', index, question });
}

function prepareMessage(game: Game, round: Round): ServerMessage {
  return {
    type: 'round:prepare',
    roundId: round.id,
    clipToken: round.clipToken,
    number: game.played,
    rounds: rounds(game),
  };
}

function startMessage(round: Round): ServerMessage {
  const { id: roundId, startsAt, endsAt, question } = round;
  return { type: 'round:start', roundId, startsAt, endsAt, options: question.options.titles };
}

function answeredMessage(round: Round): ServerMessage {
  return { type: 'round:answered', roundId: round.id, playerIds: answeredIds(round) };
}

function overtimeMessage(round: Round, overtime: { startsAt: number; endsAt: number }): ServerMessage {
  return { type: 'round:overtime', roundId: round.id, ...overtime };
}

// Everyone in the lobby plays from this round on: late joiners start at 0.
function beginRound(draft: Draft, index: number, clip: { question: Question; clipToken: string }): void {
  const { game, now } = draft;
  for (const id of game.players) {
    if (!game.participants.includes(id)) game.participants.push(id);
    game.standings[id] ??= { ...EMPTY_STANDING };
  }
  game.played++;
  game.nextIndex = index + 1;
  const round: Round = {
    id: `${game.id}.${game.played}`,
    question: clip.question,
    clipToken: clip.clipToken,
    phase: 'preparing',
    ready: [],
    noAudio: [],
    startsAt: 0,
    endsAt: 0,
    closeAt: 0,
    overtime: null,
    answers: [],
    reveal: null,
  };
  game.round = round;
  send(draft, prepareMessage(game, round));
  draft.effects.push({ type: 'timer', name: 'barrier', roundId: round.id, at: now + GAME_TIMING.barrierMs });
  requestCut(draft, index + 1);
}

// Begins the next round whose clip is ready, skipping rounds whose clip failed, or finishes the game.
function advance(draft: Draft): void {
  const { game } = draft;
  while (game.nextIndex < game.questions.length) {
    const clip = game.clips[game.nextIndex];
    if (clip === undefined) return requestCut(draft, game.nextIndex);
    if (clip !== 'failed') return beginRound(draft, game.nextIndex, clip);
    game.dropped++;
    game.nextIndex++;
  }
  finish(draft);
}

function startRound(draft: Draft, round: Round): void {
  const { game, now } = draft;
  round.startsAt = now + (game.played === 1 ? GAME_TIMING.firstLeadMs : GAME_TIMING.leadMs);
  round.endsAt = round.startsAt + game.settings.sampleLengthSec * 1000;
  round.closeAt = round.endsAt + GAME_TIMING.graceMs;
  round.noAudio.push(...game.participants.filter((id) => !round.ready.includes(id) && !round.noAudio.includes(id)));
  round.phase = 'playing';
  send(draft, startMessage(round));
  draft.effects.push({ type: 'timer', name: 'close', roundId: round.id, at: round.closeAt });
}

function standingViews(game: Game): StandingView[] {
  return game.participants.map((playerId) => {
    const { score, streak } = game.standings[playerId] ?? EMPTY_STANDING;
    return { playerId, score, streak };
  });
}

// Scores the round (a skipped one scores nothing and keeps streaks), then reveals the answer.
function closeRound(draft: Draft, round: Round, skipped: boolean): void {
  const { game, now } = draft;
  const answers: Answer[] = round.answers.map(({ playerId, correct, responseMs }) => ({
    playerId,
    correct,
    responseMs,
  }));
  const windowMs = game.settings.sampleLengthSec * 1000;
  const current = game.participants.map((playerId) => ({ playerId, ...(game.standings[playerId] ?? EMPTY_STANDING) }));
  const awards = skipped ? [] : scoreQuestion(game.settings.scoring, windowMs, answers, current);
  const picks: Pick[] = game.participants.map((playerId) => {
    const answer = round.answers.find((candidate) => candidate.playerId === playerId);
    const award = awards.find((candidate) => candidate.playerId === playerId);
    const standing = game.standings[playerId] ?? { ...EMPTY_STANDING };
    if (award) {
      standing.score += award.points;
      standing.streak = award.streak;
      standing.bestStreak = Math.max(standing.bestStreak, award.streak);
      if (answer?.correct) {
        standing.correct++;
        standing.correctMs += answer.responseMs;
      }
    }
    game.standings[playerId] = standing;
    return {
      playerId,
      option: answer?.option ?? null,
      points: award?.points ?? 0,
      noAudio: round.noAudio.includes(playerId),
    };
  });
  round.phase = 'revealing';
  game.playedThemeIds.push(round.question.themeId);
  const { question } = round;
  const { cover, ...song } = question.reveal;
  const right = round.answers.filter((answer) => answer.correct).map((answer) => answer.playerId);
  game.songs.push({ number: game.played, skipped, right, ...song });
  round.reveal = {
    type: 'round:reveal',
    roundId: round.id,
    skipped,
    correct: question.correctIndex,
    ...question.reveal,
    picks,
    standings: standingViews(game),
  };
  send(draft, round.reveal);
  draft.effects.push({ type: 'timer', name: 'reveal', roundId: round.id, at: now + GAME_TIMING.revealMs });
  draft.effects.push({
    type: 'expire-clip',
    clipToken: round.clipToken,
    at: now + GAME_TIMING.revealMs + GAME_TIMING.clipLingerMs,
  });
}

function results(game: Game): ResultView[] {
  const tallies = game.participants.map((playerId) => {
    const standing = game.standings[playerId] ?? EMPTY_STANDING;
    return { playerId, score: standing.score, correctResponseMs: standing.correctMs };
  });
  return rankPlayers(tallies).map(({ playerId, score }) => {
    const { correct, correctMs, bestStreak } = game.standings[playerId] ?? EMPTY_STANDING;
    return { playerId, score, correct, averageMs: correct > 0 ? Math.round(correctMs / correct) : null, bestStreak };
  });
}

function finish(draft: Draft): void {
  const { game } = draft;
  game.finished = true;
  game.round = null;
  send(draft, { type: 'game:results', standings: results(game) });
  draft.effects.push({ type: 'finished' });
}

// A round waits for connected players only, and never starts or ends early with nobody connected.
function allConnectedDone(game: Game, done: string[]): boolean {
  const waiting = connected(game, game.participants);
  return waiting.length > 0 && waiting.every((id) => done.includes(id));
}

function answeredIds(round: Round): string[] {
  return round.answers.map((answer) => answer.playerId);
}

// After someone drops or leaves, the players still connected may all be done already.
function recheck(draft: Draft): void {
  const { game } = draft;
  const round = game.round;
  if (round?.phase === 'preparing' && allConnectedDone(game, round.ready)) startRound(draft, round);
  else if (round?.phase === 'playing' && allConnectedDone(game, answeredIds(round))) everyoneAnswered(draft, round);
}

// Every connected player has answered: the round closes, or with answer changes on, first runs its
// overtime, which never outlasts the clip. A switch doesn't restart it.
function everyoneAnswered(draft: Draft, round: Round): void {
  const { game, now } = draft;
  if (!answersCanChange(game.settings)) return closeRound(draft, round, false);
  if (round.overtime) return;
  const overtime = { startsAt: now, endsAt: Math.min(now + game.settings.overtimeSec * 1000, round.endsAt) };
  round.overtime = overtime;
  round.closeAt = overtime.endsAt + GAME_TIMING.graceMs;
  send(draft, overtimeMessage(round, overtime));
  draft.effects.push({ type: 'timer', name: 'close', roundId: round.id, at: round.closeAt });
}

function pickOf(round: Round, event: AnswerEvent, now: number): AnswerRecord {
  const compensation = Math.min(event.rttMs / 2, GAME_TIMING.maxRttCompensationMs);
  const correct = event.option === round.question.correctIndex;
  const responseMs = Math.max(0, Math.round(now - round.startsAt - compensation));
  return { playerId: event.playerId, option: event.option, correct, responseMs };
}

// A switch takes the time it was made, so in Speed it costs points as a late answer does. The others hear
// who switched, never to what.
function switchAnswer(draft: Draft, round: Round, previous: AnswerRecord, event: AnswerEvent): void {
  const { game, now } = draft;
  if (!answersCanChange(game.settings) || previous.option === event.option) return;
  Object.assign(previous, pickOf(round, event, now));
  const others = game.players.filter((id) => id !== event.playerId);
  send(draft, { type: 'round:switched', roundId: round.id, playerId: event.playerId }, others);
}

function onAnswer(draft: Draft, event: AnswerEvent): void {
  const { game, now } = draft;
  const round = game.round;
  if (!round || round.id !== event.roundId || round.phase !== 'playing') return;
  if (!game.participants.includes(event.playerId)) return;
  const answersEndAt = round.overtime?.endsAt ?? round.endsAt;
  if (now < round.startsAt || now > answersEndAt + GAME_TIMING.graceMs) return;
  const previous = round.answers.find((answer) => answer.playerId === event.playerId);
  if (previous) return switchAnswer(draft, round, previous, event);
  const pick = pickOf(round, event, now);
  round.answers.push(pick);
  send(draft, answeredMessage(round));
  if (allConnectedDone(game, answeredIds(round))) return everyoneAnswered(draft, round);
  // In First correct a later answer may still have the lower adjusted time, so the round waits the
  // compensation cap before it closes.
  const closeAt = now + GAME_TIMING.maxRttCompensationMs;
  if (game.settings.scoring.mode === 'firstCorrect' && pick.correct && closeAt < round.closeAt) {
    round.closeAt = closeAt;
    draft.effects.push({ type: 'timer', name: 'close', roundId: round.id, at: closeAt });
  }
}

function onTimer(draft: Draft, event: TimerEvent): void {
  const { game, now } = draft;
  const round = game.round;
  if (!round || round.id !== event.roundId) return;
  if (event.name === 'barrier' && round.phase === 'preparing') {
    // With nobody connected there is no one to play for, so the game ends.
    if (connected(game, game.players).length === 0) return finish(draft);
    return startRound(draft, round);
  }
  if (event.name === 'close' && round.phase === 'playing' && now >= round.closeAt) {
    return closeRound(draft, round, false);
  }
  if (event.name === 'reveal' && round.phase === 'revealing') {
    game.round = null;
    advance(draft);
  }
}

// What a player who (re)connects needs to rejoin the round in progress. After the game, the lobby state
// carries the results instead (gameView).
function catchUp(draft: Draft, playerId: string): void {
  const round = draft.game.round;
  if (!round) return;
  send(draft, prepareMessage(draft.game, round), [playerId]);
  if (round.phase === 'playing') {
    send(draft, startMessage(round), [playerId]);
    send(draft, answeredMessage(round), [playerId]);
    if (round.overtime) send(draft, overtimeMessage(round, round.overtime), [playerId]);
    const pick = round.answers.find((answer) => answer.playerId === playerId);
    if (pick) send(draft, { type: 'round:pick', roundId: round.id, option: pick.option }, [playerId]);
  }
  if (round.reveal) send(draft, round.reveal, [playerId]);
}

function onPlayer(draft: Draft, event: PlayerEvent): void {
  const { game } = draft;
  const id = event.playerId;
  if (event.type === 'player-joined' && !game.players.includes(id)) {
    game.players.push(id);
    game.away.push(id);
  } else if (event.type === 'player-connected' && game.away.includes(id)) {
    game.away = game.away.filter((candidate) => candidate !== id);
    catchUp(draft, id);
  } else if (event.type === 'player-disconnected' && !game.away.includes(id)) {
    game.away.push(id);
    recheck(draft);
  } else if (event.type === 'player-left') {
    game.players = game.players.filter((candidate) => candidate !== id);
    game.away = game.away.filter((candidate) => candidate !== id);
    game.participants = game.participants.filter((candidate) => candidate !== id);
    delete game.standings[id];
    if (game.players.length === 0) return finish(draft);
    recheck(draft);
  }
}

function onClip(draft: Draft, event: ClipEvent): void {
  const { game } = draft;
  game.clips[event.index] =
    event.type === 'clip-ready' ? { question: event.question, clipToken: event.clipToken } : 'failed';
  if (event.type === 'clip-ready') game.questions[event.index] = event.question;
  if (!game.round && event.index === game.nextIndex) advance(draft);
}

function onReady(draft: Draft, event: ReadyEvent): void {
  const round = draft.game.round;
  if (!round || round.id !== event.roundId || round.phase !== 'preparing') return;
  if (!draft.game.participants.includes(event.playerId) || round.ready.includes(event.playerId)) return;
  round.ready.push(event.playerId);
  if (!event.loaded) round.noAudio.push(event.playerId);
  recheck(draft);
}

function onSkip(draft: Draft): void {
  const round = draft.game.round;
  if (round && round.phase !== 'revealing') closeRound(draft, round, true);
}

export function step(game: Game, event: GameEvent, now: number): Step {
  if (game.finished) return { game, effects: [] };
  const draft: Draft = { game: structuredClone(game), effects: [], now };
  if (event.type === 'clip-ready' || event.type === 'clip-failed') onClip(draft, event);
  else if (event.type === 'ready') onReady(draft, event);
  else if (event.type === 'answer') onAnswer(draft, event);
  else if (event.type === 'timer') onTimer(draft, event);
  else if (event.type === 'skip') onSkip(draft);
  else onPlayer(draft, event);
  return { game: draft.game, effects: draft.effects };
}

export interface NewGame {
  id: string;
  settings: LobbySettings;
  questions: Question[];
  players: string[];
  away: string[];
}

// The first clip is cut at once; the first round begins when it's ready.
export function startGame({ id, settings, questions, players, away }: NewGame): Step {
  const game: Game = {
    id,
    settings,
    questions,
    players: [...players],
    away: [...away],
    participants: [],
    standings: {},
    round: null,
    nextIndex: 0,
    clips: {},
    cutsRequested: [],
    played: 0,
    dropped: 0,
    playedThemeIds: [],
    songs: [],
    finished: false,
  };
  const draft: Draft = { game, effects: [], now: 0 };
  advance(draft);
  return { game, effects: draft.effects };
}

export function gameView(game: Game): GameView {
  return {
    phase: game.finished ? 'results' : 'playing',
    number: game.played,
    rounds: rounds(game),
    results: game.finished ? results(game) : null,
    songs: game.finished ? game.songs : null,
  };
}

export function scoreOf(game: Game, playerId: string): number {
  return game.standings[playerId]?.score ?? 0;
}
