// Runs the lobbies' games (docs/product-specs/game-flow.md). It starts a game for the host, feeds the engine
// its events, and carries out the engine's effects: timers on the scheduler, each clip cut a round ahead,
// clip tokens, and messages through its listener, the realtime layer.
import type { ErrorCode, GameView, ReportReason, ServerMessage, TallyView } from '../../shared/protocol.ts';
import { LIMITS } from '../../shared/settings.ts';
import type { Catalog } from '../catalog/load.ts';
import type { CutClip } from '../clips/cut.ts';
import { prepareClip } from '../clips/prepare.ts';
import type { ClipTokens } from '../clips/tokens.ts';
import type { Logger } from '../log.ts';
import type { Scheduler } from '../scheduler.ts';
import { newToken } from '../tokens.ts';
import { gameView, livesOf, scoreOf, startGame, step } from './engine.ts';
import type { Game, GameEffect, GameEvent, TimerName } from './engine.ts';
import type { Lobby } from './lobby.ts';
import { poolSize } from './pool.ts';
import { buildGame, moreQuestions, replacementQuestion } from './questions.ts';
import type { Question } from './questions.ts';
import type { Random } from './random.ts';
import type { LobbyRegistry, RegistryEvent, Seat } from './registry.ts';
import type { Reports } from '../reports.ts';

// A clip token whose reveal never comes (the game ended early) still expires after this long.
const CLIP_TOKEN_MAX_MS = 10 * 60_000;

interface Run {
  code: string;
  game: Game;
  timers: Map<string, () => void>; // cancel functions, by timer name and round
  known: Map<string, boolean>; // the lobby's players as the game last saw them, and whether connected
  reported: Set<string>; // player and round number of each clip report, so a player reports a clip once
}

export type GamesEvent =
  { type: 'send'; to: string[]; message: ServerMessage } | { type: 'lobby-changed'; code: string };

export interface GamesOptions {
  registry: LobbyRegistry;
  catalog: Catalog;
  // Null when the audio folder or ffmpeg is missing: no game can start.
  clips: { cut: CutClip; tokens: ClipTokens } | null;
  maxGames: number;
  scheduler: Scheduler;
  random: Random;
  log: Logger;
  reports: Reports;
}

// A lobby's games so far, and each player's wins and points across them.
interface Tally {
  games: number;
  players: Map<string, { wins: number; points: number }>;
}

function connectionsOf(lobby: Lobby): Map<string, boolean> {
  return new Map(lobby.players.map((player) => [player.id, player.connectedSince !== null]));
}

// The questions an endless game is dealt at a time.
const ENDLESS_BATCH = 5;

export class Games {
  readonly #options: GamesOptions;
  readonly #runs = new Map<string, Run>();
  readonly #played = new Map<string, Set<number>>(); // theme ids each lobby has played
  readonly #tallies = new Map<string, Tally>();
  #listener: (event: GamesEvent) => void = () => {};

  constructor(options: GamesOptions) {
    this.#options = options;
    options.registry.subscribe((event) => this.#onRegistryEvent(event));
  }

  subscribe(listener: (event: GamesEvent) => void): void {
    this.#listener = listener;
  }

  running(code: string): boolean {
    const run = this.#runs.get(code);
    return run !== undefined && !run.game.finished;
  }

  view(code: string): GameView | null {
    const run = this.#runs.get(code);
    return run ? gameView(run.game) : null;
  }

  // A player who joined during the game watches until the next round.
  spectating(code: string, playerId: string): boolean {
    const run = this.#runs.get(code);
    return run !== undefined && !run.game.finished && !run.game.participants.includes(playerId);
  }

  // The tally of the lobby's finished games, for the players still in it.
  tally(code: string, playerIds: string[]): TallyView | null {
    const tally = this.#tallies.get(code);
    if (!tally) return null;
    const players = playerIds.flatMap((playerId) => {
      const line = tally.players.get(playerId);
      return line ? [{ playerId, ...line }] : [];
    });
    return { games: tally.games, players };
  }

  // A player's lives in a running or last Elimination game, undefined otherwise.
  lives(code: string, playerId: string): number | undefined {
    const run = this.#runs.get(code);
    return run ? livesOf(run.game, playerId) : undefined;
  }

  score(code: string, playerId: string): number {
    const run = this.#runs.get(code);
    return run ? scoreOf(run.game, playerId) : 0;
  }

  start(seat: Seat): ErrorCode | null {
    const { registry, catalog, clips, maxGames, random, log } = this.#options;
    const lobby = registry.lobby(seat.code);
    if (!lobby) return null;
    if (lobby.hostId !== seat.playerId) return 'not-host';
    if (this.running(lobby.code)) return 'game-running';
    if (!clips) return 'not-ready';
    if ([...this.#runs.keys()].filter((code) => this.running(code)).length >= maxGames) return 'server-busy';
    // An endless game starts with one batch and draws the next as it goes.
    const firstBatch = lobby.settings.endless
      ? { ...lobby.settings, songsPerGame: LIMITS.songsPerGame.min }
      : lobby.settings;
    if (poolSize(catalog, firstBatch).anime < firstBatch.songsPerGame) return 'pool-too-small';
    const played = this.#played.get(lobby.code) ?? new Set<number>();
    const questions = buildGame(catalog, firstBatch, random, played);
    const known = connectionsOf(lobby);
    const players = [...known.keys()];
    const away = players.filter((id) => !known.get(id));
    const teams = Object.fromEntries(lobby.players.map((player) => [player.id, player.team]));
    const started = startGame({
      id: newToken().slice(0, 8),
      settings: lobby.settings,
      questions,
      players,
      away,
      teams,
    });
    this.#runs.get(lobby.code)?.timers.forEach((cancel) => cancel());
    const run: Run = { code: lobby.code, game: started.game, timers: new Map(), known, reported: new Set() };
    this.#runs.set(lobby.code, run);
    log.info('game.started', { code: lobby.code, rounds: questions.length });
    this.#listener({ type: 'lobby-changed', code: lobby.code });
    this.#apply(run, started.effects);
    return null;
  }

  ready(seat: Seat, roundId: string, loaded: boolean): void {
    this.#step(seat.code, { type: 'ready', playerId: seat.playerId, roundId, loaded });
  }

  answer(seat: Seat, roundId: string, option: number): void {
    this.#step(seat.code, { type: 'answer', playerId: seat.playerId, roundId, option });
  }

  hint(seat: Seat, roundId: string): void {
    this.#step(seat.code, { type: 'hint', playerId: seat.playerId, roundId });
  }

  // A report of a round the lobby's current or last game has revealed. Each player reports a clip once; a
  // second report, or one of a round not yet revealed, is dropped without a word.
  report(seat: Seat, number: number, reason: ReportReason): void {
    const run = this.#runs.get(seat.code);
    const key = `${seat.playerId}:${number}`;
    if (!run || run.reported.has(key)) return;
    const question = this.#questionOf(run.game, number);
    if (!question) return;
    run.reported.add(key);
    const at = this.#options.scheduler.now();
    this.#options.reports.add({ at, themeId: question.themeId, startMs: question.clip.startMs, reason });
  }

  // The question of a round already played, or of the round being played now, which a player may report while
  // it runs.
  #questionOf(game: Game, number: number): Question | undefined {
    if (game.round && number === game.played) return game.round.question;
    const index = game.songs.findIndex((song) => song.number === number);
    if (index < 0) return undefined;
    const themeId = game.playedThemeIds[index];
    return game.questions.find((candidate) => candidate.themeId === themeId);
  }

  // The host ends the game now, in any phase, with its results.
  end(seat: Seat): ErrorCode | null {
    if (this.#options.registry.lobby(seat.code)?.hostId !== seat.playerId) return 'not-host';
    this.#step(seat.code, { type: 'end' });
    return null;
  }

  skip(seat: Seat): ErrorCode | null {
    if (this.#options.registry.lobby(seat.code)?.hostId !== seat.playerId) return 'not-host';
    this.#step(seat.code, { type: 'skip' });
    return null;
  }

  #step(code: string, event: GameEvent): void {
    const run = this.#runs.get(code);
    if (!run) return;
    const next = step(run.game, event, this.#options.scheduler.now());
    run.game = next.game;
    this.#apply(run, next.effects);
  }

  #apply(run: Run, effects: GameEffect[]): void {
    for (const effect of effects) {
      if (effect.type === 'send') this.#listener({ type: 'send', to: effect.to, message: effect.message });
      else if (effect.type === 'timer') this.#setTimer(run, effect.name, effect.roundId, effect.at);
      else if (effect.type === 'cut-clip') this.#cut(run, effect.index, effect.question);
      else if (effect.type === 'expire-clip') this.#options.clips?.tokens.expireAt(effect.clipToken, effect.at);
      else if (effect.type === 'more-questions') this.#more(run);
      else this.#finished(run);
    }
    // A new round turns spectators into players, so the lobby state changes with it.
    if (effects.some((effect) => effect.type === 'send' && effect.message.type === 'round:prepare')) {
      this.#listener({ type: 'lobby-changed', code: run.code });
    }
  }

  // A later timer of the same name and round replaces an earlier one, such as an early close.
  #setTimer(run: Run, name: TimerName, roundId: string, at: number): void {
    const key = `${name}:${roundId}`;
    run.timers.get(key)?.();
    const cancel = this.#options.scheduler.at(at, () => {
      run.timers.delete(key);
      if (this.#runs.get(run.code) === run) this.#step(run.code, { type: 'timer', name, roundId });
    });
    run.timers.set(key, cancel);
  }

  // Deals an endless game its next batch, after the step that asked for it has been applied.
  #more(run: Run): void {
    const { catalog, random } = this.#options;
    const questions = moreQuestions(catalog, run.game.settings, random, run.game.questions, ENDLESS_BATCH);
    queueMicrotask(() => {
      if (this.#runs.get(run.code) === run && !run.game.finished)
        this.#step(run.code, { type: 'questions', questions });
    });
  }

  #cut(run: Run, index: number, question: Question): void {
    const { clips, catalog, random, scheduler, log } = this.#options;
    if (!clips) return;
    const current = () => this.#runs.get(run.code) === run && !run.game.finished;
    const replace = (tried: readonly Question[]) =>
      replacementQuestion(catalog, run.game.settings, random, [...run.game.questions, ...tried]);
    const logFailure = (line: string) => log.warn('clip.failed', { code: run.code, detail: line });
    prepareClip(question, { cut: clips.cut, replace, log: logFailure }).then(
      (prepared) => {
        if (!current()) return;
        const clipToken = clips.tokens.issue(run.code, prepared.audio, scheduler.now() + CLIP_TOKEN_MAX_MS);
        this.#step(run.code, { type: 'clip-ready', index, question: prepared.question, clipToken });
      },
      () => {
        if (!current()) return;
        log.error('round.dropped', { code: run.code, round: index + 1 });
        this.#step(run.code, { type: 'clip-failed', index });
      },
    );
  }

  #finished(run: Run): void {
    run.timers.forEach((cancel) => cancel());
    run.timers.clear();
    const played = this.#played.get(run.code) ?? new Set<number>();
    for (const themeId of run.game.playedThemeIds) played.add(themeId);
    this.#played.set(run.code, played);
    this.#count(run);
    this.#options.log.info('game.finished', { code: run.code, rounds: run.game.played - run.game.dropped });
    this.#listener({ type: 'lobby-changed', code: run.code });
  }

  // Adds a finished game to the lobby's tally, unless no round could be played. Everyone on the top score
  // wins, if it is above zero.
  #count(run: Run): void {
    const results = gameView(run.game).results ?? [];
    if (gameView(run.game).rounds === 0 || results.length === 0) return;
    const tally = this.#tallies.get(run.code) ?? { games: 0, players: new Map() };
    const top = Math.max(...results.map((result) => result.score));
    tally.games++;
    for (const { playerId, score } of results) {
      const line = tally.players.get(playerId) ?? { wins: 0, points: 0 };
      line.points += score;
      if (score === top && top > 0) line.wins++;
      tally.players.set(playerId, line);
    }
    this.#tallies.set(run.code, tally);
  }

  #onRegistryEvent(event: RegistryEvent): void {
    if (event.type === 'closed') {
      this.#runs.get(event.code)?.timers.forEach((cancel) => cancel());
      this.#runs.delete(event.code);
      this.#played.delete(event.code);
      this.#tallies.delete(event.code);
    } else if (event.type === 'changed' && this.running(event.lobby.code)) {
      this.#syncPlayers(event.lobby);
    }
  }

  // Tells the game who joined, left, dropped or came back since it last looked.
  #syncPlayers(lobby: Lobby): void {
    const run = this.#runs.get(lobby.code);
    if (!run) return;
    const now = connectionsOf(lobby);
    const events: GameEvent[] = [];
    for (const [playerId, wasConnected] of run.known) {
      const isConnected = now.get(playerId);
      if (isConnected === undefined) events.push({ type: 'player-left', playerId });
      else if (isConnected !== wasConnected) {
        events.push({ type: isConnected ? 'player-connected' : 'player-disconnected', playerId });
      }
    }
    for (const [playerId, isConnected] of now) {
      if (run.known.has(playerId)) continue;
      const team = lobby.players.find((player) => player.id === playerId)?.team;
      events.push({ type: 'player-joined', playerId, ...(team === undefined ? {} : { team }) });
      if (isConnected) events.push({ type: 'player-connected', playerId });
    }
    run.known = now;
    for (const event of events) this.#step(lobby.code, event);
  }
}
