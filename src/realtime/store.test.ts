import { expect, test } from 'vitest';
import type { ServerMessage } from '../../shared/protocol.ts';
import { FakeClipPlayer, OPTIONS, SESSION, lobbyState, revealOf, socketFactory } from '../testing/fakes.ts';
import type { ExitReason } from './connection.ts';
import { GameStore } from './store.ts';

const PLAYING = { phase: 'playing', number: 1, rounds: 5, results: null, songs: null } as const;
const NOW = 1_000_000;

function prepare(roundId: string): ServerMessage {
  return { type: 'round:prepare', roundId, clipToken: `clip-${roundId}`, number: 1, rounds: 5 };
}

function start(roundId: string, startsAt = NOW + 3000): ServerMessage {
  return { type: 'round:start', roundId, startsAt, endsAt: startsAt + 20_000, options: OPTIONS };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function seatedStore() {
  const sockets = socketFactory();
  const audio = new FakeClipPlayer();
  const exits: ExitReason[] = [];
  const store = new GameStore({
    session: SESSION,
    audio,
    onExit: (reason) => exits.push(reason),
    createSocket: sockets.create,
    now: () => NOW,
  });
  store.connect();
  const socket = sockets.latest();
  socket.open();
  socket.receive(lobbyState({ game: PLAYING }));
  return { store, socket, audio, exits };
}

test('loads each clip, reports it ready, and plays it at the start on this clock', async () => {
  const { socket, audio } = seatedStore();
  const pingsBefore = socket.sentOfType('time:ping').length;
  socket.receive(prepare('g.1'));
  expect(socket.sentOfType('time:ping')).toHaveLength(pingsBefore + 1);
  await settle();
  expect(socket.sentOfType('round:ready')).toEqual([{ type: 'round:ready', roundId: 'g.1', loaded: true }]);
  const ping = socket.sentOfType('time:ping').at(-1);
  socket.receive({ type: 'time:pong', clientTime: ping?.clientTime, serverTime: NOW + 700 });
  socket.receive(start('g.1', NOW + 3000));
  expect(audio.calls).toEqual(['load clip-g.1', `play ${NOW + 2300}`]);
});

test('reports a clip that failed, and sends no ready once the round has started', async () => {
  const { socket, audio } = seatedStore();
  audio.loaded = false;
  socket.receive(prepare('g.1'));
  await settle();
  expect(socket.sentOfType('round:ready').at(-1)).toEqual({ type: 'round:ready', roundId: 'g.1', loaded: false });
  audio.hold = true;
  socket.receive(prepare('g.2'));
  socket.receive(start('g.2'));
  audio.release();
  await settle();
  expect(socket.sentOfType('round:ready')).toHaveLength(1);
});

test('stops the clip for a skipped round and at the end of the game, but lets it play through a reveal', () => {
  const { socket, audio } = seatedStore();
  socket.receive(prepare('g.1'));
  socket.receive(start('g.1'));
  socket.receive(revealOf('g.1'));
  expect(audio.calls.at(-1)).toMatch(/^play/);
  socket.receive(prepare('g.2'));
  socket.receive(start('g.2'));
  socket.receive(revealOf('g.2', { skipped: true }));
  expect(audio.calls.at(-1)).toBe('stop');
  socket.receive(prepare('g.3'));
  socket.receive({ type: 'game:results', standings: [] });
  expect(audio.calls.at(-1)).toBe('stop');
});

test('sends one answer per round', () => {
  const { store, socket } = seatedStore();
  socket.receive(prepare('g.1'));
  store.answer(1);
  socket.receive(start('g.1'));
  store.answer(2);
  store.answer(3);
  expect(socket.sentOfType('answer')).toEqual([{ type: 'answer', roundId: 'g.1', option: 2 }]);
  expect(store.getSnapshot().game.round?.choice).toBe(2);
});

test("shows the host's settings edit at once, until the server has it", () => {
  const { store, socket } = seatedStore();
  const lobby = lobbyState();
  socket.receive(lobby);
  const edited = { ...lobby.settings, songsPerGame: 5 };
  store.updateSettings(edited);
  expect(socket.sentOfType('settings:update')).toEqual([{ type: 'settings:update', settings: edited }]);
  expect(store.getSnapshot().settings).toEqual(edited);
  socket.receive(lobbyState({ players: [] }));
  expect(store.getSnapshot().settings).toEqual(edited);
  socket.receive(lobbyState({ settings: { ...edited, scoring: { ...edited.scoring } } }));
  socket.receive(lobbyState({ settings: { ...lobby.settings, songsPerGame: 7 } }));
  expect(store.getSnapshot().settings?.songsPerGame).toBe(7);
});

test('never sends settings the server would refuse', () => {
  const { store, socket } = seatedStore();
  const { settings } = lobbyState();
  store.updateSettings({ ...settings, songsPerGame: 3 });
  store.updateSettings({ ...settings, formats: [] });
  expect(socket.sentOfType('settings:update')).toEqual([]);
});

test('shows a refusal as a notice until it is dismissed', () => {
  const { store, socket } = seatedStore();
  socket.receive({ type: 'error', code: 'pool-too-small' });
  const notice = store.getSnapshot().notice;
  expect(notice?.code).toBe('pool-too-small');
  store.dismissNotice(notice?.id ?? 0);
  expect(store.getSnapshot().notice).toBeNull();
});

test('leaving gives up the seat at once', () => {
  const { store, socket, exits, audio } = seatedStore();
  store.leave();
  expect(socket.sentOfType('lobby:leave')).toHaveLength(1);
  expect(socket.closedByClient).toBe(true);
  expect(exits).toEqual(['left']);
  expect(audio.calls.at(-1)).toBe('stop');
});

test('exits when the server ends the seat', () => {
  const { socket, exits } = seatedStore();
  socket.closeFromServer(4001);
  expect(exits).toEqual(['kicked']);
});

test("tells the screens whether this player's clip is loading, ready or failed", async () => {
  const { store, socket, audio } = seatedStore();
  audio.hold = true;
  socket.receive(prepare('g.1'));
  expect(store.getSnapshot().clip).toEqual({ roundId: 'g.1', status: 'loading' });
  audio.release();
  await settle();
  expect(store.getSnapshot().clip).toEqual({ roundId: 'g.1', status: 'ready' });
  audio.hold = false;
  audio.loaded = false;
  socket.receive(prepare('g.2'));
  await settle();
  expect(store.getSnapshot().clip).toEqual({ roundId: 'g.2', status: 'failed' });
});
