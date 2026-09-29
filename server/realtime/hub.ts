// The lobby sockets (docs/design-docs/system-design.md#decision): one WebSocket per player at /ws. On upgrade
// it checks the origin and the per-IP cap. `hello` binds a socket to its seat, messages become registry
// calls, and every registry change goes out as each player's lobby state. Limits: docs/SECURITY.md#input.
import { STATUS_CODES } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { CLOSE_CODES, parseClientMessage } from '../../shared/protocol.ts';
import type { ClientMessage, ErrorCode, PlayerView, ServerMessage } from '../../shared/protocol.ts';
import { clientIp } from '../client-ip.ts';
import type { Lobby } from '../game/lobby.ts';
import type { LobbyRegistry, RegistryEvent, Seat } from '../game/registry.ts';
import type { Logger } from '../log.ts';
import { RateLimit } from '../rate-limit.ts';

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

interface Connection {
  socket: WebSocket;
  ip: string;
  seat: Seat | null;
  strikes: number;
  messages: RateLimit;
  alive: boolean;
}

export interface RealtimeOptions {
  registry: LobbyRegistry;
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

function playerViews(lobby: Lobby): PlayerView[] {
  return lobby.players.map(({ id, name, score, connectedSince }) => ({
    id,
    name,
    score,
    connected: connectedSince !== null,
  }));
}

export class Realtime {
  readonly #wss = new WebSocketServer({ noServer: true, maxPayload: REALTIME_LIMITS.maxPayloadBytes });
  readonly #connections = new Set<Connection>();
  readonly #bySeat = new Map<string, Connection>(); // by player id
  readonly #registry: LobbyRegistry;
  readonly #allowedOrigins: readonly string[];
  readonly #trustedHops: number;
  readonly #log: Logger;
  readonly #now: () => number;
  readonly #timers: NodeJS.Timeout[];

  constructor(server: Server, { registry, allowedOrigins, trustedHops, log, now = Date.now }: RealtimeOptions) {
    this.#registry = registry;
    this.#allowedOrigins = allowedOrigins;
    this.#trustedHops = trustedHops;
    this.#log = log;
    this.#now = now;
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => this.#upgrade(req, socket, head));
    registry.subscribe((event) => this.#onRegistryEvent(event));
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
    const connection: Connection = { socket, ip, seat: null, strikes: 0, messages, alive: true };
    this.#connections.add(connection);
    const helloTimer = setTimeout(() => {
      if (!connection.seat) socket.close(CLOSE_CODES.invalidMessages, 'expected hello');
    }, REALTIME_LIMITS.helloTimeoutMs);
    socket.on('message', (data: RawData, isBinary: boolean) => this.#receive(connection, data, isBinary));
    socket.on('pong', () => {
      connection.alive = true;
    });
    // ws closes the socket itself after an error, such as a frame over maxPayload (1009).
    socket.on('error', (error: Error) => this.#log.debug('socket.error', { message: error.message }));
    socket.on('close', () => {
      clearTimeout(helloTimer);
      this.#closed(connection);
    });
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
        return this.#report(connection, this.#registry.updateSettings(seat, message.settings));
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

  #closeSeats(matches: (seat: Seat) => boolean, code: number, reason: string): void {
    for (const connection of [...this.#bySeat.values()]) {
      if (!connection.seat || !matches(connection.seat)) continue;
      this.#unbind(connection);
      connection.socket.close(code, reason);
    }
  }

  #broadcast(lobby: Lobby): void {
    const connections = lobby.players.flatMap((player) => this.#bySeat.get(player.id) ?? []);
    if (connections.length === 0) return;
    const { code, hostId, locked, settings } = lobby;
    const shared = { code, hostId, locked, settings, players: playerViews(lobby), pool: this.#registry.pool(lobby) };
    for (const connection of connections) {
      const you = connection.seat?.playerId ?? '';
      send(connection, { type: 'lobby:state', ...shared, you, bounds: this.#registry.bounds });
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
      connection.socket.ping();
    }
  }
}
