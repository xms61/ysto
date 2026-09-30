import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.tsx';
import { AudioEngine } from './audio/engine.ts';
import { writeSession } from './realtime/session.ts';
import { FakeAudioContext, OPTIONS, SESSION, lobbyState, revealOf, socketFactory } from './testing/fakes.ts';

const PLAYING = { phase: 'playing', number: 1, rounds: 5, results: null } as const;

function renderApp() {
  const context = new FakeAudioContext();
  const audio = new AudioEngine({
    createContext: () => context,
    fetch: async () => new Response(new ArrayBuffer(8)),
    now: () => Date.now(),
  });
  const sockets = socketFactory();
  render(
    <App audio={audio} storage={{ local: localStorage, session: sessionStorage }} createSocket={sockets.create} />,
  );
  return { sockets, context };
}

// A tab that already holds a seat, as after a reload: it connects to the lobby straight away.
function renderSeated(lobby = lobbyState()) {
  writeSession(sessionStorage, SESSION);
  const app = renderApp();
  const socket = app.sockets.latest();
  act(() => {
    socket.open();
    socket.receive(lobby);
  });
  return { ...app, socket };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('shows the game title', () => {
  renderApp();
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('You Skipped The OP?!');
});

test('opens a join link ready to join that lobby', () => {
  window.history.replaceState(null, '', '/j/abc234');
  renderApp();
  expect(screen.getByRole('button', { name: 'Join lobby ABC234' })).toBeTruthy();
});

test('creates a lobby, unlocks the sound on the same click, and says hello with the new seat', async () => {
  const fetch = vi.fn(async () => Response.json({ ...SESSION }, { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  const { sockets, context } = renderApp();
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Ann ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create a lobby' }));
  expect(context.state).toBe('running');
  const socket = await vi.waitFor(() => sockets.latest());
  expect(fetch).toHaveBeenCalledWith(
    '/api/lobbies',
    expect.objectContaining({ body: JSON.stringify({ name: 'Ann' }) }),
  );
  act(() => socket.open());
  expect(socket.sent[0]).toEqual({ type: 'hello', sessionToken: SESSION.sessionToken });
  act(() => socket.receive(lobbyState()));
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lobby ABC234');
  expect((screen.getByLabelText('Join link') as HTMLInputElement).value).toBe('http://localhost:3000/j/ABC234');
  expect(window.location.pathname).toBe('/j/ABC234');
});

test('words a refused join, and checks names before sending them', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ error: 'lobby-not-found' }, { status: 404 }));
  renderApp();
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create a lobby' }));
  expect(screen.getByRole('alert').textContent).toBe('Names need 1 to 20 characters.');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ben' } });
  fireEvent.change(screen.getByLabelText('Lobby code'), { target: { value: 'zzz999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect((await screen.findByRole('alert')).textContent).toBe(
    "That code doesn't match a lobby. Check it with the host.",
  );
});

test('lets only the host start, and only once enough anime match', () => {
  renderSeated(lobbyState({ pool: { themes: 9, anime: 4 } }));
  const start = screen.getByRole('button', { name: 'Start game' }) as HTMLButtonElement;
  expect(start.disabled).toBe(true);
  expect(screen.getByText(/Play at most 4 songs/)).toBeTruthy();
  expect(screen.getByLabelText('Songs per game')).toBeTruthy();
  cleanup();
  renderSeated(lobbyState({ you: 'p2' }));
  expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
  expect(screen.getByText('15 songs, 20 s each')).toBeTruthy();
});

test('sends a settings change the host makes', () => {
  const { socket } = renderSeated();
  const songs = screen.getByLabelText('Songs per game');
  fireEvent.change(songs, { target: { value: '8' } });
  fireEvent.keyDown(songs, { key: 'Enter' });
  expect(socket.sentOfType('settings:update').at(-1)?.settings).toMatchObject({ songsPerGame: 8 });
});

test('keeps the options hidden until the clip starts', () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() + 60_000;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  expect(screen.getByText('Round 1 of 5')).toBeTruthy();
  expect(screen.queryByText('Rain Song')).toBeNull();
});

test('answers with the number keys, then shows the reveal with words as well as icons', async () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  await screen.findByText('Rain Song');
  fireEvent.keyDown(screen.getByLabelText(/^Volume/), { key: '2' });
  expect(socket.sentOfType('answer')).toEqual([]);
  fireEvent.keyDown(window, { key: '3' });
  expect(socket.sentOfType('answer')).toEqual([{ type: 'answer', roundId: 'g.1', option: 2 }]);
  expect(screen.getByText('Locked in. Waiting for the others.')).toBeTruthy();
  act(() => socket.receive(revealOf('g.1')));
  expect(screen.getByRole('heading', { name: 'The answer' })).toBeTruthy();
  expect(screen.getByText('Right: +850')).toBeTruthy();
  expect(screen.getByText('Right answer, your pick')).toBeTruthy();
  expect(screen.getByText('no audio')).toBeTruthy();
  expect(screen.getByText('by Singer (as Heroine)')).toBeTruthy();
});

test("greets a missed opening with the game's own line, with the penalty when there is one", async () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  await screen.findByText('Rain Song');
  const picks = [
    { playerId: 'p1', option: 0, points: -250, noAudio: false },
    { playerId: 'p2', option: null, points: 0, noAudio: false },
  ];
  act(() => socket.receive(revealOf('g.1', { picks })));
  expect(screen.getByText('You skipped the OP?! −250')).toBeTruthy();
});

test('applies the theme and motion picked in the preferences at once', () => {
  renderApp();
  expect(document.documentElement.dataset.theme).toBe('tokyo-rain');
  expect(document.documentElement.dataset.motion).toBe('full');
  fireEvent.click(screen.getByLabelText('Sakura'));
  fireEvent.change(screen.getByLabelText('Motion'), { target: { value: 'reduced' } });
  expect(document.documentElement.dataset.theme).toBe('sakura');
  expect(document.documentElement.dataset.motion).toBe('reduced');
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({ theme: 'sakura', motion: 'reduced' });
});

test('shows the titles in the language the player picked', async () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 15, theme: 'tokyo-rain', titleLanguage: 'japanese' }));
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  expect((await screen.findByText('雨の歌')).getAttribute('lang')).toBe('ja');
});

test('shows the final results, also to a player who reconnects after the game', () => {
  renderSeated(
    lobbyState({
      game: {
        phase: 'results',
        number: 5,
        rounds: 5,
        results: [
          { playerId: 'p2', score: 2400, correct: 3, averageMs: 4200, bestStreak: 2 },
          { playerId: 'p1', score: 900, correct: 1, averageMs: null, bestStreak: 1 },
        ],
      },
    }),
  );
  expect(screen.getByRole('heading', { name: 'Final results' })).toBeTruthy();
  const standings = within(screen.getByRole('list', { name: 'Final standings' })).getAllByRole('listitem');
  expect(standings.map((standing) => standing.textContent)).toEqual([
    '1stBen3 of 5 right · 4.2 s on average · best streak 22,400 points',
    '2ndAnnyou1 of 5 right · best streak 1900 points',
  ]);
  expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
});

test('goes home with the reason when the host removes this player', () => {
  const { socket } = renderSeated();
  act(() => socket.closeFromServer(4001));
  expect(screen.getByRole('status').textContent).toBe('The host removed you from the lobby.');
  expect(sessionStorage.getItem('ysto_session')).toBeNull();
  expect(window.location.pathname).toBe('/');
});
