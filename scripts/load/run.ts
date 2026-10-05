// npm run load: plays simulated lobbies against a running server and checks the load target in
// docs/RELIABILITY.md: 25 lobbies of 8 players, clips under 1 s and event-loop lag under 50 ms at the 95th
// percentile. Each bot is a player: it joins, fetches every clip, readies, answers after a short think (or, one
// round in ten, lets it run out) and pings every 2 s. Each bot sends its own client address, so the per-IP limits don't stop the run; the server must
// trust it (YSTO_TRUST_PROXY=1), as the fixture server does: run it against `node e2e/fixture-server.ts`, never
// against a server players use.
import { parseArgs } from 'node:util';
import WebSocket from 'ws';
import { parseFlagsOrExit, runOrExit } from '../catalog/cli.ts';
import { verdictOf } from './stats.ts';
import type { LoadResult } from './stats.ts';

const USAGE =
  'usage: npm run load -- [--url <server, default http://localhost:4173>] [--lobbies <default 25>] ' +
  '[--players <per lobby, default 8>] [--rounds <default 5>] (each 1 to 250)';
const PING_EVERY_MS = 2000;
const THINK_MIN_MS = 500;
const THINK_MAX_MS = 4000;
// Some players don't know the song and let the round run out, which ends it on its close timer.
const SKIP_SHARE = 0.1;
const GAME_TIMEOUT_MS = 5 * 60_000;

const flags = parseFlagsOrExit(USAGE, () => {
  const options = {
    url: { type: 'string' },
    lobbies: { type: 'string' },
    players: { type: 'string' },
    rounds: { type: 'string' },
  } as const;
  const { values } = parseArgs({ options, strict: true });
  const whole = (raw: string | undefined, fallback: number, name: string) => {
    const value = Number(raw ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 250)
      throw new Error(`--${name} must be a whole number, 1 to 250`);
    return value;
  };
  return {
    url: new URL(values.url ?? 'http://localhost:4173'),
    lobbies: whole(values.lobbies, 25, 'lobbies'),
    players: whole(values.players, 8, 'players'),
    rounds: whole(values.rounds, 5, 'rounds'),
  };
});

interface Seat {
  code: string;
  playerId: string;
  sessionToken: string;
}

type Message = { type: string } & Record<string, unknown>;

const result: LoadResult = { lobbies: flags.lobbies, finishedGames: 0, clipMs: [], pingMs: [], errors: [] };

// One address per bot, so each counts on its own against the per-IP limits, in a range of its own for each run,
// since a run's lobbies stay open on the server for a while after it.
const RUN = Math.floor(Math.random() * 256);
const addressOf = (lobby: number, player: number) => `10.${RUN}.${lobby}.${player + 1}`;

async function post(path: string, ip: string, name: string): Promise<Seat> {
  const response = await fetch(new URL(path, flags.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as Seat & { error?: string };
  if (!response.ok) throw new Error(`${path}: ${body.error ?? response.status}`);
  return body;
}

async function fetchClip(token: string, seat: Seat, ip: string): Promise<boolean> {
  const started = performance.now();
  const response = await fetch(new URL(`/api/clips/${token}`, flags.url), {
    headers: { Authorization: `Bearer ${seat.sessionToken}`, 'X-Forwarded-For': ip },
  });
  await response.arrayBuffer();
  if (!response.ok) {
    result.errors.push(`clip ${response.status}`);
    return false;
  }
  result.clipMs.push(performance.now() - started);
  return true;
}

// Plays one seat until its game's results arrive. The host also sets the game's length and starts it once
// every bot has joined.
function playSeat(seat: Seat, ip: string, isHost: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const wsUrl = new URL('/ws', flags.url);
    wsUrl.protocol = flags.url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(wsUrl, { headers: { Origin: flags.url.origin, 'X-Forwarded-For': ip } });
    const send = (message: object) => socket.send(JSON.stringify(message));
    let pinger: NodeJS.Timeout | undefined;
    let started = false;
    let last = 'nothing';
    const timeout = setTimeout(
      () => finish(new Error(`${seat.code}: no results in time, last saw ${last}`)),
      GAME_TIMEOUT_MS,
    );
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      clearInterval(pinger);
      if (socket.readyState === WebSocket.OPEN) send({ type: 'lobby:leave' });
      socket.close();
      if (error) reject(error);
      else resolve();
    };

    socket.on('open', () => {
      send({ type: 'hello', sessionToken: seat.sessionToken });
      pinger = setInterval(() => send({ type: 'time:ping', clientTime: performance.now() }), PING_EVERY_MS);
    });
    socket.on('error', (error) => finish(error));
    socket.on('message', (data) => {
      const message = JSON.parse(String(data)) as Message;
      if (message.type !== 'time:pong') last = message.type;
      if (message.type === 'time:pong') result.pingMs.push(performance.now() - Number(message.clientTime));
      if (message.type === 'error') result.errors.push(String(message.code));
      if (message.type === 'lobby:state' && isHost && !started) {
        const state = message as Message & { players: unknown[]; settings: { songsPerGame: number } };
        if (state.players.length < flags.players) return;
        if (state.settings.songsPerGame !== flags.rounds) {
          send({ type: 'settings:update', settings: { ...state.settings, songsPerGame: flags.rounds } });
          return;
        }
        started = true;
        send({ type: 'game:start' });
      }
      if (message.type === 'round:prepare') {
        const roundId = message.roundId;
        void fetchClip(String(message.clipToken), seat, ip).then((loaded) =>
          send({ type: 'round:ready', roundId, loaded }),
        );
      }
      if (message.type === 'round:start' && Math.random() >= SKIP_SHARE) {
        // The clip starts at startsAt, on the server's clock, which is this machine's; a bot thinks from there.
        const untilStart = Math.max(0, Number(message.startsAt) - Date.now());
        const think = untilStart + THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
        setTimeout(
          () => send({ type: 'answer', roundId: message.roundId, option: Math.floor(Math.random() * 4) }),
          think,
        );
      }
      if (message.type === 'game:results') {
        if (isHost) result.finishedGames++;
        finish();
      }
    });
  });
}

async function playLobby(lobby: number): Promise<void> {
  const hostIp = addressOf(lobby, 0);
  const host = await post('/api/lobbies', hostIp, 'Bot 1');
  const guests = await Promise.all(
    Array.from({ length: flags.players - 1 }, (_, at) =>
      post(`/api/lobbies/${host.code}/players`, addressOf(lobby, at + 1), `Bot ${at + 2}`),
    ),
  );
  await Promise.all([
    playSeat(host, hostIp, true),
    ...guests.map((guest, at) => playSeat(guest, addressOf(lobby, at + 1), false)),
  ]);
}

runOrExit(async () => {
  console.log(
    `${flags.lobbies} lobbies of ${flags.players} players, ${flags.rounds} rounds each, on ${flags.url.origin}`,
  );
  const started = performance.now();
  const outcomes = await Promise.allSettled(Array.from({ length: flags.lobbies }, (_, lobby) => playLobby(lobby)));
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') result.errors.push(String(outcome.reason));
  }
  const { lines, passed } = verdictOf(result);
  console.log([...lines, `took ${Math.round((performance.now() - started) / 1000)} s`].join('\n'));
  if (!passed) process.exitCode = 1;
});
