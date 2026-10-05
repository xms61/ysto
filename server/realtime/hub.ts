// The lobby sockets (docs/design-docs/system-design.md#decision): one WebSocket per player at /ws. On upgrade
// it checks the origin and the per-IP cap. `hello` binds a socket to its seat, messages become registry and
// game calls, every registry change goes out as each player's lobby state, and the games' messages go to
// their players. Limits: docs/SECURITY.md#input.
import { STATUS_CODES } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { CLOSE_CODES, parseClientMessage } from '../../shared/protocol.ts';
import type { ClientMessage, ErrorCode, PlayerView, ServerMessage } from '../../shared/protocol.ts';
import { clientIp } from '../client-ip.ts';
import type { Games, GamesEvent } from '../game/games.ts';
import type { Lobby } from '../game/lobby.ts';
import type { LobbyRegistry, RegistryEvent, Seat } from '../game/registry.ts';
import type { Logger } from '../log.ts';
import { RateLimit } from '../rate-limit.ts';
import { SERVER_VERSION } from '../version.ts';

export const SOCKET_PATH = '/ws';
export const REALTIME_LIMITS = {
  maxPayloadBytes: 4096,
  connectionsPerIp: 30,
  messagesPerSecond: 20,
  strikes: 5,
  helloTimeoutMs: 10_000,
  heartbeatMs: 15_000,
  sweepMs: 5_000,
} as const;
// Answer times use the median of a socket's last few ping round trips.
const ROUND_TRIPS_KEPT = 5;

interface Connection {
  socket: WebSocket;
  ip: string;
  seat: Seat | null;
  strikes: number;
  messages: RateLimit;
  alive: boolean;
  pingSentAt: number | null;
  roundTrips: number[];
}

export interface RealtimeOptions {
  registry: LobbyRegistry;
  games: Games;
  allowedOrigins: readonly string[];
  trustedHops: number;
  log: Logger;
  now?: () => number;
}

function refuse(socket: Duplex, status: number): void {
  socket.write(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function pathnameOf(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://localhost').pathname;
}

function send(connection: Connection, message: ServerMessage): void {
  if (connection.socket.readyState === WebSocket.OPEN) connection.socket.send(JSON.stringify(message));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export class Realtime {
  readonly #wss = new WebSocketServer({ noServer: true, maxPayload: REALTIME_LIMITS.maxPayloadBytes });
  readonly #connections = new Set<Connection>();
  readonly #bySeat = new Map<string, Connection>(); // by player id
  readonly #registry: LobbyRegistry;
  readonly #games: Games;
  readonly #allowedOrigins: readonly string[];
  readonly #trustedHops: number;
  readonly #log: Logger;
  readonly #now: () => number;
  readonly #timers: NodeJS.Timeout[];

  constructor(server: Server, { registry, games, allowedOrigins, trustedHops, log, now = Date.now }: RealtimeOptions) {
    this.#registry = registry;
    this.#games = games;
    this.#allowedOrigins = allowedOrigins;
    this.#trustedHops = trustedHops;
    this.#log = log;
    this.#now = now;
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => this.#upgrade(req, socket, head));
    registry.subscribe((event) => this.#onRegistryEvent(event));
    games.subscribe((event) => this.#onGamesEvent(event));
    this.#timers = [
      setInterval(() => this.#heartbeat(), REALTIME_LIMITS.heartbeatMs),
      setInterval(() => registry.sweep(), REALTIME_LIMITS.sweepMs),
    ];
    for (const timer of this.#timers) timer.unref();
  }

  // Tells every player the server is going away, then closes their sockets.
  close(): void {
    for (const timer of this.#timers) clearInterval(timer);
    for (const connection of this.#connections) {
      send(connection, { type: 'server:closing' });
      connection.socket.close(CLOSE_CODES.serverClosing, 'server closing');
    }
    this.#wss.close();
  }

  #upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (pathnameOf(req) !== SOCKET_PATH) return refuse(socket, 404);
    if (!this.#originAllowed(req)) return refuse(socket, 403);
    const ip = clientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'], this.#trustedHops);
    const fromIp = [...this.#connections].filter((connection) => connection.ip === ip).length;
    if (fromIp >= REALTIME_LIMITS.connectionsPerIp) return refuse(socket, 429);
    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#accept(ws, ip));
  }

  // The page's own origin, or one listed in YSTO_ALLOWED_ORIGINS. Browsers always send Origin here.
  #originAllowed(req: IncomingMessage): boolean {
    const { origin, host } = req.headers;
    if (origin === undefined) return false;
    if (this.#allowedOrigins.includes(origin)) return true;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  #accept(socket: WebSocket, ip: string): void {
    const messages = new RateLimit(REALTIME_LIMITS.messagesPerSecond, 1000, this.#now);
    const connection: Connection = {
      socket,
      ip,
      seat: null,
      strikes: 0,
      messages,
      alive: true,
      pingSentAt: null,
      roundTrips: [],
    };
    this.#connections.add(connection);
    const helloTimer = setTimeout(() => {
      if (!connection.seat) socket.close(CLOSE_CODES.invalidMessages, 'expected hello');
    }, REALTIME_LIMITS.helloTimeoutMs);
    socket.on('message', (data: RawData, isBinary: boolean) => this.#receive(connection, data, isBinary));
    socket.on('pong', () => this.#pong(connection));
    // ws closes the socket itself after an error, such as a frame over maxPayload (1009).
    socket.on('error', (error: Error) => this.#log.debug('socket.error', { message: error.message }));
    socket.on('close', () => {
      clearTimeout(helloTimer);
      this.#closed(connection);
    });
  }

  // Browsers answer pings themselves, so a script can't shorten the round trip, and the engine caps what a
  // long one is worth.
  #ping(connection: Connection): void {
    connection.pingSentAt = this.#now();
    connection.socket.ping();
  }

  #pong(connection: Connection): void {
    connection.alive = true;
    if (connection.pingSentAt === null) return;
    connection.roundTrips = [...connection.roundTrips, this.#now() - connection.pingSentAt].slice(-ROUND_TRIPS_KEPT);
    connection.pingSentAt = null;
  }

  #receive(connection: Connection, data: RawData, isBinary: boolean): void {
    if (!connection.messages.take('socket')) return this.#strike(connection, 'rate-limited');
    const text = !isBinary && Buffer.isBuffer(data) ? data.toString('utf8') : '';
    const message = parseClientMessage(text, this.#registry.bounds);
    if (!message) return this.#strike(connection, 'invalid-message');
    if (connection.seat) return this.#handle(connection, connection.seat, message);
    if (message.type === 'hello') return this.#hello(connection, message.sessionToken);
    connection.socket.close(CLOSE_CODES.invalidMessages, 'expected hello');
  }

  // Invalid or excess messages get an error until the strikes run out, then the socket closes.
  #strike(connection: Connection, code: ErrorCode): void {
    connection.strikes++;
    if (connection.strikes >= REALTIME_LIMITS.strikes) {
      connection.socket.close(CLOSE_CODES.invalidMessages, 'too many invalid messages');
    } else {
      send(connection, { type: 'error', code });
    }
  }

  // A newer socket for the same seat replaces the older one, such as a reloaded tab.
  #hello(connection: Connection, sessionToken: string): void {
    const seat = this.#registry.seatOf(sessionToken);
    if (!seat) return connection.socket.close(CLOSE_CODES.unknownSession, 'unknown session');
    const previous = this.#bySeat.get(seat.playerId);
    if (previous) {
      this.#unbind(previous);
      previous.socket.close(CLOSE_CODES.replaced, 'connected elsewhere');
    }
    connection.seat = seat;
    this.#bySeat.set(seat.playerId, connection);
    this.#ping(connection);
    this.#registry.connect(sessionToken);
  }

  #handle(connection: Connection, seat: Seat, message: ClientMessage): void {
    switch (message.type) {
      case 'hello':
        return this.#strike(connection, 'invalid-message');
      case 'time:ping':
        return send(connection, { type: 'time:pong', clientTime: message.clientTime, serverTime: this.#now() });
      case 'lobby:leave':
        return this.#registry.leave(seat);
      case 'lobby:lock':
        return this.#report(connection, this.#registry.lock(seat, message.locked));
      case 'player:kick':
        return this.#report(connection, this.#registry.kick(seat, message.playerId));
      case 'settings:update':
        if (this.#games.running(seat.code)) return this.#report(connection, 'game-running');
        return this.#report(connection, this.#registry.updateSettings(seat, message.settings));
      case 'game:start':
        return this.#report(connection, this.#games.start(seat));
      case 'round:ready':
        return this.#games.ready(seat, message.roundId, message.loaded);
      case 'answer':
        return this.#games.answer(seat, message.roundId, message.option, median(connection.roundTrips));
      case 'round:skip':
        return this.#report(connection, this.#games.skip(seat));
    }
  }

  #report(connection: Connection, error: ErrorCode | null): void {
    if (error) send(connection, { type: 'error', code: error });
  }

  #closed(connection: Connection): void {
    this.#connections.delete(connection);
    const { seat } = connection;
    if (!seat) return;
    this.#unbind(connection);
    this.#registry.disconnect(seat);
  }

  #unbind(connection: Connection): void {
    if (connection.seat && this.#bySeat.get(connection.seat.playerId) === connection) {
      this.#bySeat.delete(connection.seat.playerId);
    }
    connection.seat = null;
  }

  #onRegistryEvent(event: RegistryEvent): void {
    if (event.type === 'changed') return this.#broadcast(event.lobby);
    if (event.type === 'seat-removed') {
      const code = event.reason === 'kicked' ? CLOSE_CODES.kicked : CLOSE_CODES.left;
      return this.#closeSeats((seat) => seat.playerId === event.seat.playerId, code, event.reason);
    }
    this.#closeSeats((seat) => seat.code === event.code, CLOSE_CODES.lobbyClosed, 'lobby closed');
  }

  // A fresh ping with each clip gives the round's answers a current round trip.
  #onGamesEvent(event: GamesEvent): void {
    if (event.type === 'lobby-changed') {
      const lobby = this.#registry.lobby(event.code);
      if (lobby) this.#broadcast(lobby);
      return;
    }
    for (const playerId of event.to) {
      const connection = this.#bySeat.get(playerId);
      if (!connection) continue;
      send(connection, event.message);
      if (event.message.type === 'round:prepare') this.#ping(connection);
    }
  }

  #closeSeats(matches: (seat: Seat) => boolean, code: number, reason: string): void {
    for (const connection of [...this.#bySeat.values()]) {
      if (!connection.seat || !matches(connection.seat)) continue;
      this.#unbind(connection);
      connection.socket.close(code, reason);
    }
  }

  #playerViews(lobby: Lobby): PlayerView[] {
    return lobby.players.map(({ id, name, connectedSince }) => ({
      id,
      name,
      connected: connectedSince !== null,
      spectating: this.#games.spectating(lobby.code, id),
      score: this.#games.score(lobby.code, id),
    }));
  }

  #broadcast(lobby: Lobby): void {
    const connections = lobby.players.flatMap((player) => this.#bySeat.get(player.id) ?? []);
    if (connections.length === 0) return;
    const { code, hostId, locked, settings } = lobby;
    const shared = {
      version: SERVER_VERSION,
      code,
      hostId,
      locked,
      settings,
      players: this.#playerViews(lobby),
      pool: this.#registry.pool(lobby),
      bounds: this.#registry.bounds,
      game: this.#games.view(code),
    };
    for (const connection of connections) {
      send(connection, { type: 'lobby:state', ...shared, you: connection.seat?.playerId ?? '' });
    }
  }

  // A socket that missed the last ping is gone; closing it starts its seat's reconnect grace.
  #heartbeat(): void {
    for (const connection of this.#connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      this.#ping(connection);
    }
  }
}
