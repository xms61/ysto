// The client's shell around the lobby socket. It folds the server's messages into the game state, drives the
// clip player through each round, and gives the screens one snapshot to render and the actions they may take.
import type { ErrorCode, LobbyState, ServerMessage } from '../../shared/protocol.ts';
import { validateSettings } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { isRecord } from '../../shared/validate.ts';
import type { ClipPlayer } from '../audio/engine.ts';
import { ServerClock } from './clock.ts';
import { Connection } from './connection.ts';
import type { ConnectionStatus, ExitReason, SocketLike } from './connection.ts';
import { INITIAL_GAME, choose, chooseTyped, receive } from './game-state.ts';
import type { ClientRound, GameState } from './game-state.ts';
import type { Session } from './session.ts';
import type { PlayerIcon, ReactionKind, ReportReason, TitleMatch } from '../../shared/protocol.ts';

export type NoticeCode = ErrorCode | 'server-closing';

export interface Notice {
  id: number;
  code: NoticeCode;
}

// This player's clip for a round: still loading, ready to play, or failed to load (they can still answer).
export type ClipStatus = 'loading' | 'ready' | 'failed';

export interface Snapshot {
  status: ConnectionStatus;
  game: GameState;
  settings: LobbySettings | null; // the host's edit on its way to the server, or the lobby's settings
  notice: Notice | null;
  clip: { roundId: string; status: ClipStatus } | null;
}

export interface Reaction {
  playerId: string;
  kind: ReactionKind;
}

export interface StoreOptions {
  session: Session;
  audio: ClipPlayer;
  onExit: (reason: ExitReason) => void;
  createSocket?: (url: string) => SocketLike;
  now?: () => number;
}

function socketUrl(): string {
  const url = new URL('/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

// Settings are plain JSON, and the server's copy may list keys in another order.
function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameJson(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => sameJson(a[key], b[key]));
  }
  return a === b;
}

export class GameStore {
  readonly #session: Session;
  readonly #audio: ClipPlayer;
  readonly #onExit: (reason: ExitReason) => void;
  readonly #clock: ServerClock;
  readonly #connection: Connection;
  readonly #listeners = new Set<() => void>();
  readonly #reactionListeners = new Set<(reaction: Reaction) => void>();
  readonly #titleListeners = new Set<(query: string, matches: TitleMatch[]) => void>();
  #game: GameState = INITIAL_GAME;
  #pendingSettings: LobbySettings | null = null;
  #notice: Notice | null = null;
  #clip: Snapshot['clip'] = null;
  #notices = 0;
  #snapshot: Snapshot;

  constructor({ session, audio, onExit, createSocket, now = () => Date.now() }: StoreOptions) {
    this.#session = session;
    this.#audio = audio;
    this.#onExit = onExit;
    this.#clock = new ServerClock(now);
    this.#connection = new Connection({
      url: socketUrl(),
      sessionToken: session.sessionToken,
      clock: this.#clock,
      onMessage: (message) => this.#receive(message),
      onStatus: () => this.#publish(),
      onExit: (reason) => this.#exit(reason),
      createSocket: createSocket ?? ((url) => new WebSocket(url)),
      now,
    });
    this.#snapshot = this.#buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.#snapshot;

  serverNow = (): number => this.#clock.serverNow();

  connect(): void {
    this.#connection.open();
  }

  // Closes the socket but keeps the seat, which the server holds through its reconnect grace.
  disconnect(): void {
    this.#connection.close();
    this.#audio.stop();
  }

  retryNow(): void {
    this.#connection.retryNow();
  }

  answer(option: number): void {
    const game = choose(this.#game, option);
    const round = game.round;
    if (game === this.#game || !round) return;
    if (!this.#connection.send({ type: 'answer', roundId: round.id, option })) return;
    this.#setGame(game);
  }

  answerTyped(match: TitleMatch): void {
    const game = chooseTyped(this.#game, match);
    const round = game.round;
    if (game === this.#game || !round) return;
    if (!this.#connection.send({ type: 'answer:typed', roundId: round.id, animeId: match.animeId })) return;
    this.#setGame(game);
  }

  // Asks for the suggestions for what the player typed; they come back to onTitles' listeners.
  searchTitles(query: string): void {
    this.#connection.send({ type: 'titles:search', query });
  }

  onTitles(listener: (query: string, matches: TitleMatch[]) => void): () => void {
    this.#titleListeners.add(listener);
    return () => this.#titleListeners.delete(listener);
  }

  // Asks for the round's hint; the server answers this player alone, from halfway through the round.
  takeHint(): void {
    const round = this.#game.round;
    if (round && !round.hint) this.#connection.send({ type: 'round:hint', roundId: round.id });
  }

  startGame(): void {
    this.#connection.send({ type: 'game:start' });
  }

  skipRound(): void {
    this.#connection.send({ type: 'round:skip' });
  }

  endGame(): void {
    this.#connection.send({ type: 'game:end' });
  }

  kick(playerId: string): void {
    this.#connection.send({ type: 'player:kick', playerId });
  }

  setTeam(playerId: string, team: number): void {
    this.#connection.send({ type: 'player:team', playerId, team });
  }

  shuffleTeams(): void {
    this.#connection.send({ type: 'teams:shuffle' });
  }

  chooseIcon(icon: PlayerIcon): void {
    this.#connection.send({ type: 'player:icon', icon });
  }

  setLocked(locked: boolean): void {
    this.#connection.send({ type: 'lobby:lock', locked });
  }

  // Shows the edit at once and sends it. Settings the server would refuse never leave, since every refusal
  // counts against the socket.
  updateSettings(settings: LobbySettings): void {
    const lobby = this.#game.lobby;
    if (!lobby || !validateSettings(settings, lobby.bounds)) return;
    if (!this.#connection.send({ type: 'settings:update', settings })) return;
    this.#pendingSettings = settings;
    this.#publish();
  }

  // Gives up the seat now, instead of after the reconnect grace.
  leave(): void {
    this.#connection.send({ type: 'lobby:leave' });
    this.disconnect();
    this.#onExit('left');
  }

  // A clip reported as broken: once per round, while it plays or after.
  reportClip(number: number, reason: ReportReason): void {
    if (this.#game.reported.includes(number)) return;
    if (!this.#connection.send({ type: 'clip:report', number, reason })) return;
    this.#setGame({ ...this.#game, reported: [...this.#game.reported, number] });
  }

  react(kind: ReactionKind): void {
    this.#connection.send({ type: 'reaction', kind });
  }

  // Reactions pass by: listeners hear each one as it arrives, and nothing keeps them.
  onReaction(listener: (reaction: Reaction) => void): () => void {
    this.#reactionListeners.add(listener);
    return () => this.#reactionListeners.delete(listener);
  }

  closeResults(): void {
    this.#setGame({ ...this.#game, resultsClosed: true });
  }

  dismissNotice(id: number): void {
    if (this.#notice?.id !== id) return;
    this.#notice = null;
    this.#publish();
  }

  #receive(message: ServerMessage): void {
    const before = this.#game;
    this.#game = receive(before, message);
    if (message.type === 'lobby:state') this.#settleSettings(message);
    if (message.type === 'error') {
      this.#pendingSettings = null;
      this.#showNotice(message.code);
    }
    if (message.type === 'server:closing') this.#showNotice('server-closing');
    if (message.type === 'titles:found') {
      for (const listener of this.#titleListeners) listener(message.query, message.matches);
    }
    if (message.type === 'reaction') {
      for (const listener of this.#reactionListeners) listener({ playerId: message.playerId, kind: message.kind });
    }
    this.#publish();
    this.#driveAudio(before, this.#game, message);
  }

  #driveAudio(before: GameState, after: GameState, message: ServerMessage): void {
    const round = after.round;
    if (message.type === 'round:prepare' && round && before.round?.id !== round.id) {
      this.#connection.ping();
      void this.#loadClip(round);
    } else if (message.type === 'round:start' && round?.start && round.id === message.roundId) {
      this.#audio.play(this.#clock.toLocal(round.start.startsAt));
    } else if (message.type === 'round:reveal' && message.skipped) {
      this.#audio.stop();
    } else if (before.round && !round) {
      this.#audio.stop();
    }
  }

  // The barrier waits for this player's ready, loaded or not, but a round that already started doesn't.
  async #loadClip(round: ClientRound): Promise<void> {
    this.#clip = { roundId: round.id, status: 'loading' };
    this.#publish();
    const loaded = await this.#audio.load(round.clipToken, this.#session.sessionToken);
    if (this.#clip?.roundId === round.id) {
      this.#clip = { roundId: round.id, status: loaded ? 'ready' : 'failed' };
      this.#publish();
    }
    const current = this.#game.round;
    if (current?.id === round.id && !current.start) {
      this.#connection.send({ type: 'round:ready', roundId: round.id, loaded });
    }
  }

  // The pending edit gives way once the server has it, or once this player is no longer the host.
  #settleSettings(lobby: LobbyState): void {
    const pending = this.#pendingSettings;
    if (pending && (sameJson(pending, lobby.settings) || lobby.hostId !== lobby.you)) this.#pendingSettings = null;
  }

  #showNotice(code: NoticeCode): void {
    this.#notices++;
    this.#notice = { id: this.#notices, code };
  }

  #exit(reason: ExitReason): void {
    this.#audio.stop();
    this.#publish();
    this.#onExit(reason);
  }

  #setGame(game: GameState): void {
    this.#game = game;
    this.#publish();
  }

  #buildSnapshot(): Snapshot {
    return {
      status: this.#connection.status,
      game: this.#game,
      settings: this.#pendingSettings ?? this.#game.lobby?.settings ?? null,
      notice: this.#notice,
      clip: this.#clip,
    };
  }

  #publish(): void {
    this.#snapshot = this.#buildSnapshot();
    for (const listener of this.#listeners) listener();
  }
}
