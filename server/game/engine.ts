// A game's rounds as a pure state machine (docs/product-specs/game-flow.md). `step` takes the game, an event
// and the time, and returns the next game and the effects for the shell to run: messages, timers, clip cuts
// and clip expiries. Nothing here reads a clock, a socket or a file, so a fake clock can drive whole games.
import type {
  TitleMatch,
  GameView,
  Pick,
  PlayedSong,
  ResultView,
  ServerMessage,
  StandingView,
  TeamStanding,
} from '../../shared/protocol.ts';
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
  lives: number | null; // in Elimination; null in a classic game
}

interface AnswerRecord {
  playerId: string;
  option: number | null; // null for a typed answer
  typed: TitleMatch | null;
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
  hinted: string[]; // the players who took the round's hint
  reveal: ServerMessage | null; // kept for players who reconnect during the reveal
}

export type PreparedClip = { question: Question; clipToken: string } | 'failed';

export interface Game {
  id: string;
  settings: LobbySettings;
  questions: Question[];
  players: string[]; // everyone in the lobby who plays
  screens: string[]; // party mode screens: they hear every message and play the clips, but never answer
  away: string[]; // players without a connection
  participants: string[]; // players in the rounds; a late joiner becomes one at the next round
  standings: Record<string, Standing>;
  teams: Record<string, number> | null; // with Teams: each player's team
  teamScores: number[]; // with Teams: each team's total, by team number
  round: Round | null; // null between rounds, while the next clip is being cut
  nextIndex: number; // the question the next round plays
  clips: Record<number, PreparedClip>; // by question index
  cutsRequested: number[];
  played: number; // rounds begun
  dropped: number; // rounds whose clip failed on every theme
  playedThemeIds: number[];
  songs: PlayedSong[]; // each closed round's song, for the results
  moreAsked: boolean; // an endless game waits for its next batch of questions
  exhausted: boolean; // an endless game's pool has no unplayed anime left
  finished: boolean;
}

// An endless game asks for its next batch of questions when this many are left to play.
const ENDLESS_LOW_WATER = 2;

type ClipEvent =
  { type: 'clip-ready'; index: number; question: Question; clipToken: string } | { type: 'clip-failed'; index: number };
// An endless game's next batch; none left in the pool when it is empty.
type QuestionsEvent = { type: 'questions'; questions: Question[] };
type ReadyEvent = { type: 'ready'; playerId: string; roundId: string; loaded: boolean };
// An option tapped, or with typing an anime typed: `typed` is the anime as the catalog names it.
type AnswerEvent = { type: 'answer'; playerId: string; roundId: string; option: number | null; typed?: TitleMatch };
type HintEvent = { type: 'hint'; playerId: string; roundId: string };
type TimerEvent = { type: 'timer'; name: TimerName; roundId: string };
type PlayerEvent = {
  type: 'player-joined' | 'player-connected' | 'player-disconnected' | 'player-left';
  playerId: string;
  team?: number; // a player who joins a Teams game: the team the lobby gave them
  screen?: boolean; // a party mode screen joins, not a player
};
export type GameEvent =
  | ClipEvent
  | QuestionsEvent
  | ReadyEvent
  | AnswerEvent
  | HintEvent
  | TimerEvent
  | { type: 'skip' }
  | { type: 'end' }
  | PlayerEvent;

export type GameEffect =
  | { type: 'send'; to: string[]; message: ServerMessage }
  | { type: 'timer'; name: TimerName; roundId: string; at: number }
  | { type: 'cut-clip'; index: number; question: Question }
  | { type: 'expire-clip'; clipToken: string; at: number }
  | { type: 'more-questions' }
  | { type: 'finished' };

export interface Step {
  game: Game;
  effects: GameEffect[];
}

const EMPTY_STANDING: Standing = { score: 0, streak: 0, correct: 0, correctMs: 0, bestStreak: 0, lives: null };

function eliminating(game: Game): boolean {
  return game.settings.play === 'elimination';
}

// A player still in the game: every participant in a classic game, one with a life left in Elimination.
function alive(game: Game, playerId: string): boolean {
  const lives = game.standings[playerId]?.lives;
  return lives === null || lives === undefined || lives > 0;
}

function inPlay(game: Game): string[] {
  return game.participants.filter((id) => alive(game, id));
}

function livesView(lives: number | null): { lives?: number } {
  return lives === null ? {} : { lives };
}

// A draft of the game that one event may change, and the effects it produces.
interface Draft {
  game: Game;
  effects: GameEffect[];
  now: number;
}

function send(
  draft: Draft,
  message: ServerMessage,
  to: string[] = [...draft.game.players, ...draft.game.screens],
): void {
  draft.effects.push({ type: 'send', to: [...to], message });
}

function connected(game: Game, ids: string[]): string[] {
  return ids.filter((id) => !game.away.includes(id));
}

// An endless game has no count until it ends, and then counts the rounds it played; so does an Elimination
// game, which can end before its songs run out.
function rounds(game: Game): number | null {
  if (game.finished && (game.settings.endless || eliminating(game))) return game.songs.length;
  if (game.settings.endless) return null;
  return game.questions.length - game.dropped;
}

function askForMore(draft: Draft): void {
  const { game } = draft;
  if (!game.settings.endless || game.exhausted || game.moreAsked) return;
  if (game.questions.length - game.nextIndex > ENDLESS_LOW_WATER) return;
  game.moreAsked = true;
  draft.effects.push({ type: 'more-questions' });
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

// With typing, an anime round sends no options: the player names the anime themselves.
function startMessage(game: Game, round: Round): ServerMessage {
  const { id: roundId, startsAt, endsAt, question } = round;
  const options = typing(game, round) ? { english: [], romaji: [], japanese: [] } : question.options.titles;
  return { type: 'round:start', roundId, startsAt, endsAt, options, ask: question.ask };
}

function typing(game: Game, round: Round): boolean {
  return game.settings.answerBy === 'typing' && round.question.ask === 'anime';
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
  const firstRound = game.played === 0;
  for (const id of game.players) {
    if (!game.participants.includes(id)) game.participants.push(id);
    // In Elimination a player who joins after the first round watches: they start with no lives.
    const lives = eliminating(game) ? (firstRound ? game.settings.lives : 0) : null;
    game.standings[id] ??= { ...EMPTY_STANDING, lives };
  }
  game.played++;
  game.nextIndex = index + 1;
  askForMore(draft);
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
    hinted: [],
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
  // An endless game waits for its next batch, unless the pool is spent.
  if (game.settings.endless && !game.exhausted) return askForMore(draft);
  finish(draft);
}

function startRound(draft: Draft, round: Round): void {
  const { game, now } = draft;
  round.startsAt = now + (game.played === 1 ? GAME_TIMING.firstLeadMs : GAME_TIMING.leadMs);
  round.endsAt = round.startsAt + game.settings.sampleLengthSec * 1000;
  round.closeAt = round.endsAt + GAME_TIMING.graceMs;
  // In party mode the screens play the clips, so no player is ever marked as having had no audio.
  if (!game.settings.party) {
    round.noAudio.push(...inPlay(game).filter((id) => !round.ready.includes(id) && !round.noAudio.includes(id)));
  }
  round.phase = 'playing';
  send(draft, startMessage(game, round));
  draft.effects.push({ type: 'timer', name: 'close', roundId: round.id, at: round.closeAt });
}

function standingViews(game: Game): StandingView[] {
  return game.participants.map((playerId) => {
    const { score, streak, lives } = game.standings[playerId] ?? EMPTY_STANDING;
    return { playerId, score, streak, ...livesView(lives) };
  });
}

// In Elimination a wrong or missed answer costs a life, but not a player whose clip failed to load.
function takeLives(game: Game, round: Round): void {
  if (!eliminating(game)) return;
  for (const playerId of inPlay(game)) {
    const right = round.answers.some((answer) => answer.playerId === playerId && answer.correct);
    const standing = game.standings[playerId];
    if (!right && !round.noAudio.includes(playerId) && standing?.lives) standing.lives--;
  }
}

// The game is over in Elimination once one player is left, or none when they played alone or went out together.
function lastStanding(game: Game): boolean {
  if (!eliminating(game)) return false;
  const left = inPlay(game).length;
  return left === 0 || (left === 1 && game.participants.length > 1);
}

// With Teams, each team scores the average of its connected members' points this round, so a small team can beat a
// big one; a team with nobody connected scores nothing.
function scoreTeams(game: Game, picks: Pick[]): TeamStanding[] | null {
  if (!game.teams) return null;
  const teams = game.teams;
  const standings = game.teamScores.map((score, team) => {
    const members = picks.filter((pick) => teams[pick.playerId] === team && !game.away.includes(pick.playerId));
    const total = members.reduce((sum, pick) => sum + pick.points, 0);
    const points = members.length > 0 ? Math.round(total / members.length) : 0;
    game.teamScores[team] = score + points;
    return { team, score: score + points, points };
  });
  return standings;
}

function teamResults(game: Game): TeamStanding[] | null {
  if (!game.teams) return null;
  return game.teamScores.map((score, team) => ({ team, score, points: 0 })).sort((a, b) => b.score - a.score);
}

// Scores the round (a skipped one scores nothing and keeps streaks), then reveals the answer.
function closeRound(draft: Draft, round: Round, skipped: boolean): void {
  const { game, now } = draft;
  const answers: Answer[] = round.answers.map(({ playerId, correct, responseMs }) => ({
    playerId,
    correct,
    responseMs,
    hinted: round.hinted.includes(playerId),
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
      ...(answer?.typed ? { typed: answer.typed } : {}),
      points: award?.points ?? 0,
      noAudio: round.noAudio.includes(playerId),
      hinted: round.hinted.includes(playerId),
    };
  });
  if (!skipped) takeLives(game, round);
  const teams = skipped ? (game.teams ? teamResults(game) : null) : scoreTeams(game, picks);
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
    animeId: question.animeId,
    ...question.reveal,
    picks,
    standings: standingViews(game),
    ...(teams ? { teams } : {}),
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
  const livesOf = (playerId: string) => game.standings[playerId]?.lives ?? 0;
  // Elimination ranks by lives left first; the sort is stable, so equal lives keep the score order.
  const ranked = rankPlayers(tallies).sort((a, b) => livesOf(b.playerId) - livesOf(a.playerId));
  return ranked.map(({ playerId, score }) => {
    const { correct, correctMs, bestStreak, lives } = game.standings[playerId] ?? EMPTY_STANDING;
    const averageMs = correct > 0 ? Math.round(correctMs / correct) : null;
    return { playerId, score, correct, averageMs, bestStreak, ...livesView(lives) };
  });
}

function finish(draft: Draft): void {
  const { game } = draft;
  game.finished = true;
  game.round = null;
  const teams = teamResults(game);
  send(draft, { type: 'game:results', standings: results(game), ...(teams ? { teams } : {}) });
  draft.effects.push({ type: 'finished' });
}

// A round waits for connected players only, and never starts or ends early with nobody connected.
function allConnectedDone(game: Game, done: string[]): boolean {
  const waiting = connected(game, inPlay(game));
  return waiting.length > 0 && waiting.every((id) => done.includes(id));
}

function answeredIds(round: Round): string[] {
  return round.answers.map((answer) => answer.playerId);
}

// The ready barrier: every connected player has the clip, or in party mode every connected screen (the phones
// load none); with no screen connected, the barrier's timer starts the round.
function barrierDone(game: Game, round: Round): boolean {
  if (!game.settings.party) return allConnectedDone(game, round.ready);
  const screens = connected(game, game.screens);
  return screens.length > 0 && screens.every((id) => round.ready.includes(id));
}

// After someone drops or leaves, the players still connected may all be done already.
function recheck(draft: Draft): void {
  const { game } = draft;
  const round = game.round;
  if (round?.phase === 'preparing' && barrierDone(game, round)) startRound(draft, round);
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

// An answer's time is when the server received it, with no allowance for the player's connection.
function pickOf(round: Round, event: AnswerEvent, now: number): AnswerRecord {
  const typed = event.typed ?? null;
  const correct = typed ? typed.animeId === round.question.animeId : event.option === round.question.correctIndex;
  const responseMs = Math.max(0, Math.round(now - round.startsAt));
  return { playerId: event.playerId, option: event.option, typed, correct, responseMs };
}

function sameAnswer(record: AnswerRecord, event: AnswerEvent): boolean {
  return record.option === event.option && record.typed?.animeId === event.typed?.animeId;
}

// A switch takes the time it was made, so in Speed it costs points as a late answer does. The others hear
// who switched, never to what.
function switchAnswer(draft: Draft, round: Round, previous: AnswerRecord, event: AnswerEvent): void {
  const { game, now } = draft;
  if (!answersCanChange(game.settings) || sameAnswer(previous, event)) return;
  Object.assign(previous, pickOf(round, event, now));
  const others = game.players.filter((id) => id !== event.playerId);
  send(draft, { type: 'round:switched', roundId: round.id, playerId: event.playerId }, others);
}

function onAnswer(draft: Draft, event: AnswerEvent): void {
  const { game, now } = draft;
  const round = game.round;
  if (!round || round.id !== event.roundId || round.phase !== 'playing') return;
  if (!game.participants.includes(event.playerId) || !alive(game, event.playerId)) return;
  // A typed answer only in a typing round, and a tapped option only outside one.
  if ((event.typed !== undefined) !== typing(game, round)) return;
  const answersEndAt = round.overtime?.endsAt ?? round.endsAt;
  if (now < round.startsAt || now > answersEndAt + GAME_TIMING.graceMs) return;
  const previous = round.answers.find((answer) => answer.playerId === event.playerId);
  if (previous) return switchAnswer(draft, round, previous, event);
  const pick = pickOf(round, event, now);
  round.answers.push(pick);
  send(draft, answeredMessage(round));
  if (allConnectedDone(game, answeredIds(round))) return everyoneAnswered(draft, round);
  // In First correct the first right answer to arrive wins, and the round closes on it.
  if (game.settings.scoring.mode === 'firstCorrect' && pick.correct) closeRound(draft, round, false);
}

function hintMessage(round: Round): ServerMessage {
  return { type: 'round:hint', roundId: round.id, ...round.question.hint };
}

// From halfway through the answer window until it ends, a player may take the round's hint, once; it goes to
// them alone. A player whose answer is locked in can't, since it could only cost them points.
function onHint(draft: Draft, event: HintEvent): void {
  const { game, now } = draft;
  const round = game.round;
  if (!game.settings.hints || !round || round.id !== event.roundId || round.phase !== 'playing') return;
  if (!inPlay(game).includes(event.playerId) || round.hinted.includes(event.playerId)) return;
  const halfway = round.startsAt + (round.endsAt - round.startsAt) / 2;
  if (now < halfway || now > round.endsAt) return;
  const answered = round.answers.some((answer) => answer.playerId === event.playerId);
  if (answered && !answersCanChange(game.settings)) return;
  round.hinted.push(event.playerId);
  send(draft, hintMessage(round), [event.playerId]);
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
    if (lastStanding(game)) return finish(draft);
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
    send(draft, startMessage(draft.game, round), [playerId]);
    send(draft, answeredMessage(round), [playerId]);
    if (round.overtime) send(draft, overtimeMessage(round, round.overtime), [playerId]);
    if (round.hinted.includes(playerId)) send(draft, hintMessage(round), [playerId]);
    const pick = round.answers.find((answer) => answer.playerId === playerId);
    if (pick?.typed) send(draft, { type: 'round:typed', roundId: round.id, match: pick.typed }, [playerId]);
    else if (pick?.option != null)
      send(draft, { type: 'round:pick', roundId: round.id, option: pick.option }, [playerId]);
  }
  if (round.reveal) send(draft, round.reveal, [playerId]);
}

function onPlayer(draft: Draft, event: PlayerEvent): void {
  const { game } = draft;
  const id = event.playerId;
  if (event.type === 'player-joined' && event.screen && !game.screens.includes(id)) {
    game.screens.push(id);
    game.away.push(id);
  } else if (event.type === 'player-joined' && !event.screen && !game.players.includes(id)) {
    game.players.push(id);
    game.away.push(id);
    if (game.teams && event.team !== undefined) game.teams[id] = event.team;
  } else if (event.type === 'player-connected' && game.away.includes(id)) {
    game.away = game.away.filter((candidate) => candidate !== id);
    catchUp(draft, id);
  } else if (event.type === 'player-disconnected' && !game.away.includes(id)) {
    game.away.push(id);
    recheck(draft);
  } else if (event.type === 'player-left') {
    game.players = game.players.filter((candidate) => candidate !== id);
    game.screens = game.screens.filter((candidate) => candidate !== id);
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
  const ready = inPlay(draft.game).includes(event.playerId) || draft.game.screens.includes(event.playerId);
  if (!ready || round.ready.includes(event.playerId)) return;
  round.ready.push(event.playerId);
  if (!event.loaded) round.noAudio.push(event.playerId);
  recheck(draft);
}

function onQuestions(draft: Draft, event: QuestionsEvent): void {
  const { game } = draft;
  game.moreAsked = false;
  if (event.questions.length === 0) game.exhausted = true;
  game.questions.push(...event.questions);
  if (!game.round) advance(draft);
  else requestCut(draft, game.nextIndex);
}

// The host ends the game at once; a round still running doesn't count.
function onEnd(draft: Draft): void {
  finish(draft);
}

function onSkip(draft: Draft): void {
  const round = draft.game.round;
  if (round && round.phase !== 'revealing') closeRound(draft, round, true);
}

export function step(game: Game, event: GameEvent, now: number): Step {
  if (game.finished) return { game, effects: [] };
  const draft: Draft = { game: structuredClone(game), effects: [], now };
  if (event.type === 'clip-ready' || event.type === 'clip-failed') onClip(draft, event);
  else if (event.type === 'questions') onQuestions(draft, event);
  else if (event.type === 'end') onEnd(draft);
  else if (event.type === 'ready') onReady(draft, event);
  else if (event.type === 'answer') onAnswer(draft, event);
  else if (event.type === 'hint') onHint(draft, event);
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
  teams?: Record<string, number>; // with Teams: each player's team
  screens?: string[]; // party mode screens
}

// The first clip is cut at once; the first round begins when it's ready.
export function startGame({ id, settings, questions, players, away, teams, screens = [] }: NewGame): Step {
  const playsTeams = settings.play === 'teams';
  const game: Game = {
    id,
    settings,
    questions,
    players: [...players],
    screens: [...screens],
    away: [...away],
    participants: [],
    standings: {},
    teams: playsTeams ? { ...teams } : null,
    teamScores: playsTeams ? Array.from({ length: settings.teams }, () => 0) : [],
    round: null,
    nextIndex: 0,
    clips: {},
    cutsRequested: [],
    played: 0,
    dropped: 0,
    playedThemeIds: [],
    songs: [],
    moreAsked: false,
    exhausted: false,
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
    ...(game.teams ? { teams: teamResults(game) ?? [] } : {}),
    songs: game.finished ? game.songs : null,
  };
}

export function livesOf(game: Game, playerId: string): number | undefined {
  return game.standings[playerId]?.lives ?? undefined;
}

export function scoreOf(game: Game, playerId: string): number {
  return game.standings[playerId]?.score ?? 0;
}
