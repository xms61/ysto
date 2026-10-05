// Runs the lobbies' games (docs/product-specs/game-flow.md). It starts a game for the host, feeds the engine
// its events, and carries out the engine's effects: timers on the scheduler, each clip cut a round ahead,
// clip tokens, and messages through its listener, the realtime layer.
import type { ErrorCode, GameView, ServerMessage } from '../../shared/protocol.ts';
import type { Catalog } from '../catalog/load.ts';
import type { CutClip } from '../clips/cut.ts';
import { prepareClip } from '../clips/prepare.ts';
import type { ClipTokens } from '../clips/tokens.ts';
import type { Logger } from '../log.ts';
import type { Scheduler } from '../scheduler.ts';
import { newToken } from '../tokens.ts';
import { gameView, scoreOf, startGame, step } from './engine.ts';
import type { Game, GameEffect, GameEvent, TimerName } from './engine.ts';
import type { Lobby } from './lobby.ts';
import { poolSize } from './pool.ts';
import { buildGame, replacementQuestion } from './questions.ts';
import type { Question } from './questions.ts';
import type { Random } from './random.ts';
import type { LobbyRegistry, RegistryEvent, Seat } from './registry.ts';
import type { ReportReason } from '../../shared/protocol.ts';
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

function connectionsOf(lobby: Lobby): Map<string, boolean> {
  return new Map(lobby.players.map((player) => [player.id, player.connectedSince !== null]));
}

export class Games {
  readonly #options: GamesOptions;
  readonly #runs = new Map<string, Run>();
  readonly #played = new Map<string, Set<number>>(); // theme ids each lobby has played
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
    if (poolSize(catalog, lobby.settings).anime < lobby.settings.songsPerGame) return 'pool-too-small';
    const played = this.#played.get(lobby.code) ?? new Set<number>();
    const questions = buildGame(catalog, lobby.settings, random, played);
    const known = connectionsOf(lobby);
    const players = [...known.keys()];
    const away = players.filter((id) => !known.get(id));
    const started = startGame({ id: newToken().slice(0, 8), settings: lobby.settings, questions, players, away });
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

  answer(seat: Seat, roundId: string, option: number, rttMs: number): void {
    this.#step(seat.code, { type: 'answer', playerId: seat.playerId, roundId, option, rttMs });
  }

  // A report of a round the lobby's current or last game has revealed. Each player reports a clip once; a
  // second report, or one of a round not yet revealed, is dropped without a word.
  report(seat: Seat, number: number, reason: ReportReason): void {
    const run = this.#runs.get(seat.code);
    const key = `${seat.playerId}:${number}`;
    if (!run || run.reported.has(key)) return;
    const index = run.game.songs.findIndex((song) => song.number === number);
    const themeId = run.game.playedThemeIds[index];
    const question = run.game.questions.find((candidate) => candidate.themeId === themeId);
    if (index < 0 || !question) return;
    run.reported.add(key);
    const at = this.#options.scheduler.now();
    this.#options.reports.add({ at, themeId: question.themeId, startMs: question.clip.startMs, reason });
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
    this.#options.log.info('game.finished', { code: run.code, rounds: run.game.played - run.game.dropped });
    this.#listener({ type: 'lobby-changed', code: run.code });
  }

  #onRegistryEvent(event: RegistryEvent): void {
    if (event.type === 'closed') {
      this.#runs.get(event.code)?.timers.forEach((cancel) => cancel());
      this.#runs.delete(event.code);
      this.#played.delete(event.code);
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
      events.push({ type: 'player-joined', playerId });
      if (isConnected) events.push({ type: 'player-connected', playerId });
    }
    run.known = now;
    for (const event of events) this.#step(lobby.code, event);
  }
}
