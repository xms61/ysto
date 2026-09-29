// The lobby socket. It says hello with the session token, keeps the server clock in step with time:ping,
// and reconnects after a dropped connection until the server says the seat is gone
// (server/realtime/REALTIME.md).
import { CLOSE_CODES } from '../../shared/protocol.ts';
import type { ClientMessage, ServerMessage } from '../../shared/protocol.ts';
import type { ServerClock } from './clock.ts';
import { parseServerMessage } from './messages.ts';

// Why the server let this seat go, from its close codes.
export type ExitReason = 'left' | 'kicked' | 'lobby-closed' | 'unknown-session' | 'replaced';
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

// The parts of a WebSocket the connection uses, so tests can stand in for it.
export interface SocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

const OPEN = 1; // WebSocket.OPEN
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 5000];
// Pings on connecting, one after another, give the clock a few samples before the first round.
const SYNC_PINGS = 5;
const PING_EVERY_MS = 10_000;

const EXITS = new Map<number, ExitReason>([
  [CLOSE_CODES.left, 'left'],
  [CLOSE_CODES.kicked, 'kicked'],
  [CLOSE_CODES.lobbyClosed, 'lobby-closed'],
  [CLOSE_CODES.unknownSession, 'unknown-session'],
  [CLOSE_CODES.replaced, 'replaced'],
]);

export interface ConnectionOptions {
  url: string;
  sessionToken: string;
  clock: ServerClock;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  onExit: (reason: ExitReason) => void;
  createSocket: (url: string) => SocketLike;
  now: () => number;
}

export class Connection {
  readonly #options: ConnectionOptions;
  #socket: SocketLike | null = null;
  #status: ConnectionStatus = 'closed';
  #attempt = 0;
  #syncPings = 0;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: ConnectionOptions) {
    this.#options = options;
  }

  get status(): ConnectionStatus {
    return this.#status;
  }

  open(): void {
    if (this.#socket) return;
    this.#attempt = 0;
    this.#connect('connecting');
  }

  // Closes the socket without leaving: the server keeps the seat through its reconnect grace.
  close(): void {
    clearTimeout(this.#retryTimer);
    this.#dropSocket();
    this.#setStatus('closed');
  }

  // Skips the wait before the next attempt, as when the tab comes back into view.
  retryNow(): void {
    if (this.#status !== 'reconnecting' || this.#socket) return;
    clearTimeout(this.#retryTimer);
    this.#connect('reconnecting');
  }

  // False when the socket isn't open, and the message is dropped.
  send(message: ClientMessage): boolean {
    const socket = this.#socket;
    if (socket?.readyState !== OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  ping(): void {
    this.send({ type: 'time:ping', clientTime: this.#options.now() });
  }

  #connect(status: ConnectionStatus): void {
    const socket = this.#options.createSocket(this.#options.url);
    this.#socket = socket;
    this.#setStatus(status);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'hello', sessionToken: this.#options.sessionToken }));
      this.#syncPings = 1;
      this.ping();
      this.#pingTimer = setInterval(() => this.ping(), PING_EVERY_MS);
    };
    socket.onmessage = (event) => this.#receive(event.data);
    socket.onclose = (event) => this.#closed(event.code);
  }

  #receive(data: unknown): void {
    const message = parseServerMessage(data);
    if (!message) return;
    if (message.type === 'time:pong') {
      this.#options.clock.record(message.clientTime, message.serverTime);
      if (this.#syncPings < SYNC_PINGS) {
        this.#syncPings++;
        this.ping();
      }
      return;
    }
    // The first lobby state is the server's answer to hello: the seat is bound.
    if (message.type === 'lobby:state' && this.#status !== 'open') {
      this.#attempt = 0;
      this.#setStatus('open');
    }
    this.#options.onMessage(message);
  }

  #closed(code: number): void {
    this.#dropSocket();
    const exit = EXITS.get(code);
    if (exit) {
      this.#setStatus('closed');
      this.#options.onExit(exit);
      return;
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.#attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.#attempt++;
    this.#setStatus('reconnecting');
    this.#retryTimer = setTimeout(() => this.#connect('reconnecting'), delay);
  }

  // Detaches the handlers first, so closing the socket here never looks like the server closing it.
  #dropSocket(): void {
    clearInterval(this.#pingTimer);
    const socket = this.#socket;
    this.#socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close();
  }

  #setStatus(status: ConnectionStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    this.#options.onStatus(status);
  }
}
