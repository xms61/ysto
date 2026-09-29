import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ServerMessage } from '../../shared/protocol.ts';
import { lobbyState, socketFactory } from '../testing/fakes.ts';
import { ServerClock } from './clock.ts';
import { Connection } from './connection.ts';
import type { ConnectionStatus, ExitReason } from './connection.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function connect() {
  const sockets = socketFactory();
  const received: ServerMessage[] = [];
  const statuses: ConnectionStatus[] = [];
  const exits: ExitReason[] = [];
  const clock = new ServerClock(() => Date.now());
  const connection = new Connection({
    url: 'ws://localhost/ws',
    sessionToken: 'token',
    clock,
    onMessage: (message) => received.push(message),
    onStatus: (status) => statuses.push(status),
    onExit: (reason) => exits.push(reason),
    createSocket: sockets.create,
    now: () => Date.now(),
  });
  connection.open();
  return { connection, sockets, received, statuses, exits, clock };
}

test('says hello first, then syncs the clock with five pings in a row', () => {
  const { sockets, clock } = connect();
  const socket = sockets.latest();
  socket.open();
  expect(socket.sent[0]).toEqual({ type: 'hello', sessionToken: 'token' });
  for (let pong = 0; pong < 6; pong++) {
    const ping = socket.sentOfType('time:ping').at(-1);
    socket.receive({ type: 'time:pong', clientTime: ping?.clientTime, serverTime: Date.now() + 5000 });
  }
  expect(socket.sentOfType('time:ping')).toHaveLength(5);
  expect(clock.offsetMs).toBe(5000);
  vi.advanceTimersByTime(10_000);
  expect(socket.sentOfType('time:ping')).toHaveLength(6);
});

test('is open once the server answers hello with the lobby, and passes messages on', () => {
  const { sockets, received, statuses } = connect();
  const socket = sockets.latest();
  socket.open();
  expect(statuses).toEqual(['connecting']);
  socket.receive(lobbyState());
  socket.receive('not a message');
  socket.receive({ type: 'error', code: 'not-host' });
  expect(statuses).toEqual(['connecting', 'open']);
  expect(received.map((message) => message.type)).toEqual(['lobby:state', 'error']);
});

test('reconnects after a dropped connection, waiting longer each time until it is back', () => {
  const { sockets, statuses } = connect();
  sockets.latest().closeFromServer(1006);
  expect(statuses.at(-1)).toBe('reconnecting');
  vi.advanceTimersByTime(499);
  expect(sockets.sockets).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(sockets.sockets).toHaveLength(2);
  sockets.latest().closeFromServer(1006);
  vi.advanceTimersByTime(999);
  expect(sockets.sockets).toHaveLength(2);
  vi.advanceTimersByTime(1);
  const socket = sockets.latest();
  socket.open();
  socket.receive(lobbyState());
  expect(statuses.at(-1)).toBe('open');
  socket.closeFromServer(1001);
  vi.advanceTimersByTime(500);
  expect(sockets.sockets).toHaveLength(4);
});

test('gives up the seat on the close codes that end it', () => {
  const CASES: [code: number, reason: ExitReason][] = [
    [1000, 'left'],
    [4001, 'kicked'],
    [4002, 'lobby-closed'],
    [4003, 'unknown-session'],
    [4004, 'replaced'],
  ];
  for (const [code, reason] of CASES) {
    const { sockets, exits, statuses } = connect();
    sockets.latest().closeFromServer(code);
    vi.advanceTimersByTime(10_000);
    expect(exits, String(code)).toEqual([reason]);
    expect(statuses.at(-1)).toBe('closed');
    expect(sockets.sockets).toHaveLength(1);
  }
});

test('closing it keeps quiet: no exit, no reconnect', () => {
  const { connection, sockets, exits } = connect();
  sockets.latest().open();
  connection.close();
  expect(sockets.latest().closedByClient).toBe(true);
  vi.advanceTimersByTime(10_000);
  expect(exits).toEqual([]);
  expect(sockets.sockets).toHaveLength(1);
  expect(connection.send({ type: 'game:start' })).toBe(false);
});

test('retries at once when asked, instead of waiting', () => {
  const { connection, sockets } = connect();
  sockets.latest().closeFromServer(1006);
  connection.retryNow();
  expect(sockets.sockets).toHaveLength(2);
});
