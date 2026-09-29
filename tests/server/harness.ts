// An in-process server for the HTTP and socket tests: the real app and realtime layer on a free port, a
// synthetic catalog, a fake clock for the registry, and clients that wait for the messages they expect.
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import type { ClientOptions } from 'ws';
import { createApp } from '../../server/app.ts';
import { LobbyRegistry } from '../../server/game/registry.ts';
import { createLogger } from '../../server/log.ts';
import { Realtime } from '../../server/realtime/hub.ts';
import type { LobbyState, ServerMessage } from '../../shared/protocol.ts';
import { syntheticCatalog } from '../game/fixtures.ts';

const catalog = syntheticCatalog();
const WAIT_MS = 2000;

export interface ServerOptions {
  maxPlayers?: number;
  trustedProxyHops?: number;
  allowedOrigins?: string[];
}

export interface TestServer {
  baseUrl: string;
  wsUrl: string;
  origin: string;
  registry: LobbyRegistry;
  realtime: Realtime;
  clock: { now: number };
  post: (path: string, body: unknown, headers?: Record<string, string>) => Promise<Response>;
  close: () => Promise<void>;
}

export async function startServer({
  maxPlayers = 12,
  trustedProxyHops = 0,
  allowedOrigins = [],
}: ServerOptions = {}): Promise<TestServer> {
  const clock = { now: 1_000_000 };
  const log = createLogger('error', () => {});
  const registry = new LobbyRegistry({ catalog, maxLobbies: 100, maxPlayers, log, now: () => clock.now });
  // The folder holds no client build, so only the API and the checks answer.
  const app = createApp({ clientDir: join(tmpdir(), 'ysto-no-client'), registry, trustedProxyHops, log });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const realtime = new Realtime(server, { registry, allowedOrigins, trustedHops: trustedProxyHops, log });
  // A server listening on a TCP port always reports an AddressInfo, never a pipe name.
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const close = async () => {
    realtime.close();
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  };
  return { baseUrl, wsUrl: `ws://127.0.0.1:${port}/ws`, origin: baseUrl, registry, realtime, clock, post, close };
}

export interface Seat {
  code: string;
  playerId: string;
  sessionToken: string;
}

export async function createLobby(
  server: TestServer,
  name: string,
  headers: Record<string, string> = {},
): Promise<Seat> {
  const response = await server.post('/api/lobbies', { name }, headers);
  if (response.status !== 201) throw new Error(`create answered ${response.status}`);
  // A 201 from this route carries the creator's seat.
  return (await response.json()) as Seat;
}

export async function joinLobby(server: TestServer, code: string, name: string): Promise<Seat> {
  const response = await server.post(`/api/lobbies/${code}/players`, { name });
  if (response.status !== 201) throw new Error(`join answered ${response.status}`);
  // A 201 from this route carries the new player's id and session.
  return { code, ...((await response.json()) as Omit<Seat, 'code'>) };
}

export class TestClient {
  readonly socket: WebSocket;
  readonly closed: Promise<{ code: number; reason: string }>;
  readonly #queue: ServerMessage[] = [];
  #wake: () => void = () => {};

  constructor(url: string, options: ClientOptions) {
    this.socket = new WebSocket(url, options);
    this.socket.on('message', (data) => {
      this.#queue.push(JSON.parse(String(data)) as ServerMessage);
      this.#wake();
    });
    this.closed = new Promise((resolve) => {
      this.socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
    });
  }

  static async open(server: TestServer, headers: Record<string, string> = {}): Promise<TestClient> {
    const client = new TestClient(server.wsUrl, { origin: server.origin, headers });
    await once(client.socket, 'open');
    return client;
  }

  // Opens a socket and says hello, then waits for the first lobby state.
  static async seated(server: TestServer, seat: Seat): Promise<TestClient> {
    const client = await TestClient.open(server);
    client.send({ type: 'hello', sessionToken: seat.sessionToken });
    await client.state();
    return client;
  }

  send(message: unknown): void {
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  // Skips messages until one matches, failing if none arrives in time.
  async next(matches: (message: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + WAIT_MS;
    for (;;) {
      const message = this.#queue.shift();
      if (message && matches(message)) return message;
      if (message) continue;
      if (Date.now() > deadline) throw new Error('no matching message arrived in time');
      await new Promise<void>((resolve) => {
        this.#wake = resolve;
        setTimeout(resolve, 50);
      });
    }
  }

  async state(matches: (state: LobbyState) => boolean = () => true): Promise<LobbyState> {
    const message = await this.next((candidate) => candidate.type === 'lobby:state' && matches(candidate));
    if (message.type !== 'lobby:state') throw new Error('expected a lobby state');
    return message;
  }
}
