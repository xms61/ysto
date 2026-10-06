import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SCORING_PRESETS } from '../shared/scoring.ts';
import { App } from './App.tsx';
import { AudioEngine } from './audio/engine.ts';
import { writeSession } from './realtime/session.ts';
import { FakeAudioContext, OPTIONS, SESSION, lobbyState, revealOf, socketFactory } from './testing/fakes.ts';

// The stage's hidden copies (the slot's timer and verdict, each card's back) repeat text; only what shows counts.
const SHOWN = { ignore: '[aria-hidden="true"] *' };

const PLAYING = { phase: 'playing', number: 1, rounds: 5, results: null, songs: null } as const;

function renderApp(reload = () => {}) {
  const context = new FakeAudioContext();
  const audio = new AudioEngine({
    createContext: () => context,
    fetch: async () => new Response(new ArrayBuffer(8)),
    now: () => Date.now(),
  });
  const sockets = socketFactory();
  render(
    <App
      audio={audio}
      storage={{ local: localStorage, session: sessionStorage }}
      createSocket={sockets.create}
      reload={reload}
    />,
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

// jsdom has no modal dialogs; the stand-in opens the dialog in place, which is all these tests need.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
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

test('reloads to a new server version once, and never during a round', () => {
  writeSession(sessionStorage, SESSION);
  const reload = vi.fn();
  const socket = renderApp(reload).sockets.latest();
  const RESULTS = { phase: 'results' as const, number: 5, rounds: 5, results: [], songs: [] };
  act(() => {
    socket.open();
    socket.receive(lobbyState({ version: '9.9.9', game: PLAYING }));
  });
  expect(reload).not.toHaveBeenCalled();
  act(() => socket.receive(lobbyState({ version: '9.9.9', game: RESULTS })));
  expect(reload).toHaveBeenCalledTimes(1);
  act(() => socket.receive(lobbyState({ version: '9.9.9', game: null })));
  expect(reload).toHaveBeenCalledTimes(1);
});

test("tells a returning player what's new once, on the home screen", () => {
  localStorage.setItem('ysto_seen_version', '1.0.0');
  renderApp();
  const dialog = screen.getByRole('dialog', { name: "What's new" });
  expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThan(0);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
  expect(screen.queryByRole('dialog', { name: "What's new" })).toBeNull();
  cleanup();
  renderApp();
  expect(screen.queryByRole('dialog', { name: "What's new" })).toBeNull();
});

test("keeps what's new for the lobby when a returning player is in a round", () => {
  localStorage.setItem('ysto_seen_version', '1.0.0');
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  expect(screen.queryByRole('dialog', { name: "What's new" })).toBeNull();
  act(() => socket.receive(lobbyState({ game: null })));
  expect(screen.getByRole('dialog', { name: "What's new" })).toBeTruthy();
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

test('with answer changes on, lets the player switch, runs the overtime and names who switched', async () => {
  const lobby = lobbyState({ game: PLAYING });
  const { socket } = renderSeated({ ...lobby, settings: { ...lobby.settings, answerChanges: true } });
  const startsAt = Date.now() - 100;
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Rain Song' }));
  fireEvent.click(screen.getByRole('button', { name: 'Petal Story' }));
  expect(socket.sentOfType('answer').map((message) => message.option)).toEqual([0, 1]);
  expect(screen.getByText('Locked in for now. Tap another card to switch.')).toBeTruthy();
  act(() => {
    socket.receive({ type: 'round:switched', roundId: 'g.1', playerId: 'p2' });
    socket.receive({ type: 'round:overtime', roundId: 'g.1', startsAt: Date.now(), endsAt: Date.now() + 5000 });
  });
  expect(screen.getByText('Ben switched')).toBeTruthy();
  expect(screen.getByText('Overtime', SHOWN)).toBeTruthy();
  expect(screen.getByText('Last chance to switch', SHOWN)).toBeTruthy();
});

test('with hints on, offers the hint from halfway, shows it, and marks who took it at the reveal', async () => {
  const lobby = lobbyState({ game: PLAYING });
  const { socket } = renderSeated({ ...lobby, settings: { ...lobby.settings, hints: true } });
  const startsAt = Date.now() - 11_000;
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  fireEvent.click(await screen.findByRole('button', { name: /^Hint: when it aired/ }));
  expect(socket.sentOfType('round:hint')).toEqual([{ type: 'round:hint', roundId: 'g.1' }]);
  act(() => socket.receive({ type: 'round:hint', roundId: 'g.1', format: 'TV', season: 'Spring', year: 2013 }));
  expect(screen.getByText('TV, Spring 2013')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Hint: when it aired/ })).toBeNull();
  const picks = [
    { playerId: 'p1', option: 2, points: 700, noAudio: false, hinted: true },
    { playerId: 'p2', option: 0, points: 0, noAudio: false, hinted: false },
  ];
  act(() => socket.receive(revealOf('g.1', { picks })));
  expect(screen.getAllByText('hint', SHOWN)).toHaveLength(1);
});

test('switching a buzzer game to Elimination moves it to Classic scoring, and offers its lives', () => {
  const base = lobbyState();
  const { socket } = renderSeated({ ...base, settings: { ...base.settings, scoring: { ...SCORING_PRESETS.buzzer } } });
  fireEvent.click(screen.getByLabelText(/^Elimination:/));
  expect(socket.sentOfType('settings:update').at(-1)?.settings).toMatchObject({
    play: 'elimination',
    scoring: SCORING_PRESETS.classic,
  });
  act(() => socket.receive({ ...base, settings: { ...base.settings, play: 'elimination' } }));
  expect((screen.getByLabelText('Lives') as HTMLSelectElement).value).toBe('3');
  expect((screen.getByLabelText(/^Buzzer/) as HTMLInputElement).disabled).toBe(true);
});

test("in Elimination shows each player's lives, and lets a player who is out only watch", async () => {
  const base = lobbyState({ game: PLAYING });
  const players = [
    { ...base.players[0]!, lives: 0 },
    { ...base.players[1]!, lives: 2 },
  ];
  const { socket } = renderSeated({ ...base, players, settings: { ...base.settings, play: 'elimination' } });
  const startsAt = Date.now() - 100;
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  expect(await screen.findByText("You're out. Watch who lasts.")).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Rain Song' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('2 lives')).toBeTruthy();
  expect(screen.getByText('out')).toBeTruthy();
});

test('with Teams, shows the teams in the lobby, lets a player switch and the host shuffle', () => {
  const base = lobbyState();
  const players = [
    { ...base.players[0]!, team: 0 },
    { ...base.players[1]!, team: 1 },
  ];
  const { socket } = renderSeated({ ...base, players, settings: { ...base.settings, play: 'teams' } });
  const teams = screen.getByRole('region', { name: 'Teams' });
  expect(within(teams).getByRole('heading', { name: /^Kitsune/ })).toBeTruthy();
  expect(within(teams).getByRole('heading', { name: /^Tanuki/ })).toBeTruthy();
  fireEvent.change(within(teams).getByLabelText('Your team'), { target: { value: '1' } });
  expect(socket.sentOfType('player:team')).toEqual([{ type: 'player:team', playerId: 'p1', team: 1 }]);
  fireEvent.change(within(teams).getByLabelText("Ben's team"), { target: { value: '0' } });
  expect(socket.sentOfType('player:team').at(-1)).toEqual({ type: 'player:team', playerId: 'p2', team: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Shuffle the teams' }));
  expect(socket.sentOfType('teams:shuffle')).toHaveLength(1);
});

test('runs an endless game without a round count, and lets the host end it', () => {
  const base = lobbyState();
  const endless = { ...base.settings, endless: true };
  const { socket } = renderSeated(lobbyState({ settings: endless, game: { ...PLAYING, rounds: null } }));
  act(() => socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: null }));
  expect(screen.getByRole('heading', { name: 'Round 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'End the game' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  expect(socket.sentOfType('game:end')).toHaveLength(1);
});

test('sets the round as a masthead number in Back Issue, still named as the round', () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 15, theme: 'retro-vhs' }));
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
  });
  const heading = screen.getByRole('heading', { name: 'Round 1 of 5' });
  expect(within(heading).getByText('01')).toBeTruthy();
  expect(within(heading).getByText('/ 05')).toBeTruthy();
});

test('sings the round as a lyric line in Karaoke Box, still named as the round, with the options in rows', async () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 15, theme: 'karaoke' }));
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 10_000;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  const heading = screen.getByRole('heading', { name: 'Round 1 of 5' });
  const sung = Number(heading.style.getPropertyValue('--sung'));
  expect(sung).toBeGreaterThan(0.4);
  expect(sung).toBeLessThan(0.6);
  const options = await screen.findByRole('list', { name: 'Options' });
  expect(options.className).toContain('grid-cols-1');
});

test('answers with the number keys, then shows the reveal with words as well as icons', async () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  await screen.findByText('Rain Song', SHOWN);
  // The options can render from a timer outside act, so flush the effects that attach the number keys.
  await act(async () => {});
  fireEvent.keyDown(screen.getByLabelText(/^Volume/), { key: '2' });
  expect(socket.sentOfType('answer')).toEqual([]);
  fireEvent.keyDown(window, { key: '3' });
  expect(socket.sentOfType('answer')).toEqual([{ type: 'answer', roundId: 'g.1', option: 2 }]);
  expect(screen.getByText('Locked in. Waiting for the others.')).toBeTruthy();
  expect(screen.queryByText(/Picked by/)).toBeNull();
  act(() => socket.receive(revealOf('g.1')));
  expect(screen.getByRole('heading', { name: 'The answer' })).toBeTruthy();
  expect(screen.getByText('Right: +850')).toBeTruthy();
  expect(document.querySelector('.card[data-turned] .card-back:not(.card-sizer)')?.textContent).toMatch(
    /^Right answer, your pick/,
  );
  expect(screen.getByText('no audio')).toBeTruthy();
  expect(screen.getByText('by Singer (as Heroine)')).toBeTruthy();
  // Who picked what shows only now, under each card.
  const options = within(screen.getByRole('list', { name: 'Options' })).getAllByRole('listitem');
  expect(options[2]?.textContent).toContain('Picked by Ann');
  expect(options[0]?.textContent).toContain('Picked by Ben');
  expect(options[1]?.textContent).not.toContain('Picked by');
});

test('keeps the scores beside the round, with who has answered, and each pick on the board at the reveal', async () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
    socket.receive({ type: 'round:answered', roundId: 'g.1', playerIds: ['p2'] });
  });
  await screen.findByText('Rain Song', SHOWN);
  const live = within(screen.getByRole('region', { name: 'Scores' }));
  expect(live.getByText('answered')).toBeTruthy();
  expect(live.getByText('thinking')).toBeTruthy();
  act(() => socket.receive(revealOf('g.1')));
  const board = within(screen.getByRole('list', { name: 'Scores' }));
  expect(board.getByText('picked 3')).toBeTruthy();
  expect(board.getByText('picked 1')).toBeTruthy();
});

test('reports a broken clip from the reveal once, with a fixed reason', () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    socket.receive(revealOf('g.1'));
  });
  fireEvent.click(screen.getByText('Report this clip'));
  fireEvent.click(screen.getByRole('button', { name: 'Cut badly' }));
  expect(socket.sentOfType('clip:report')).toEqual([{ type: 'clip:report', number: 1, reason: 'bad-cut' }]);
  expect(screen.getByText('Reported. Thanks.')).toBeTruthy();
  expect(screen.queryByText('Report this clip')).toBeNull();
});

test("greets a missed opening with the game's own line, with the penalty when there is one", async () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  await screen.findByText('Rain Song', SHOWN);
  const picks = [
    { playerId: 'p1', option: 0, points: -250, noAudio: false, hinted: false },
    { playerId: 'p2', option: null, points: 0, noAudio: false, hinted: false },
  ];
  act(() => socket.receive(revealOf('g.1', { picks })));
  expect(screen.getByText('You skipped the OP?! −250')).toBeTruthy();
});

test('applies the motion picked in the preferences at once', () => {
  renderApp();
  expect(document.documentElement.dataset.motion).toBe('full');
  fireEvent.change(screen.getByLabelText('Motion'), { target: { value: 'reduced' } });
  expect(document.documentElement.dataset.motion).toBe('reduced');
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({ motion: 'reduced' });
});

test('turns the sound effects off from the preferences', () => {
  renderApp();
  const box = screen.getByLabelText('Sound effects');
  expect((box as HTMLInputElement).checked).toBe(true);
  fireEvent.click(box);
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({ soundEffects: false });
});

test('keeps both title languages when the second becomes the first', () => {
  renderApp();
  fireEvent.change(screen.getByLabelText('And under them, smaller'), { target: { value: 'japanese' } });
  fireEvent.change(screen.getByLabelText('Anime titles in'), { target: { value: 'japanese' } });
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({
    titleLanguage: 'japanese',
    secondTitleLanguage: 'english',
  });
});

function openThemeSheet() {
  fireEvent.click(screen.getByRole('button', { name: /^Neon Rain, choose a world$/ }));
  return screen.getByRole('dialog', { name: 'Choose a world' });
}

test('tries a world on from the picker, and keeps it only when the player uses it', () => {
  renderApp();
  expect(document.documentElement.dataset.theme).toBe('tokyo-rain');
  let sheet = openThemeSheet();
  fireEvent.click(within(sheet).getByLabelText(/^Omikuji/));
  expect(document.documentElement.dataset.theme).toBe('omikuji');
  expect(within(sheet).getByText('Shrine fortune slips in spring')).toBeTruthy();
  fireEvent.click(within(sheet).getByRole('button', { name: 'Back' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.documentElement.dataset.theme).toBe('tokyo-rain');
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({ theme: 'tokyo-rain' });

  sheet = openThemeSheet();
  fireEvent.click(within(sheet).getByLabelText(/^Quest Board/));
  fireEvent.click(within(sheet).getByRole('button', { name: 'Use this world' }));
  expect(document.documentElement.dataset.theme).toBe('isekai');
  expect(JSON.parse(localStorage.getItem('ysto_prefs') ?? '{}')).toMatchObject({ theme: 'isekai' });
});

test('surprises the player with another world, at once when motion is reduced', () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 15, theme: 'tokyo-rain', motion: 'reduced' }));
  renderApp();
  const sheet = openThemeSheet();
  fireEvent.click(within(sheet).getByRole('button', { name: 'Surprise me' }));
  expect(document.documentElement.dataset.theme).not.toBe('tokyo-rain');
});

test('shows the titles in the language the player picked', async () => {
  localStorage.setItem('ysto_prefs', JSON.stringify({ volume: 15, theme: 'tokyo-rain', titleLanguage: 'japanese' }));
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  expect((await screen.findByText('雨の歌', SHOWN)).getAttribute('lang')).toBe('ja');
});

test('shows a second title language under the first', async () => {
  const prefs = { volume: 15, theme: 'tokyo-rain', titleLanguage: 'english', secondTitleLanguage: 'japanese' };
  localStorage.setItem('ysto_prefs', JSON.stringify(prefs));
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 100;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
  });
  expect((await screen.findByText('雨の歌', SHOWN)).getAttribute('lang')).toBe('ja');
  expect(screen.getByRole('button', { name: /^Rain Song,\s?雨の歌$/ })).toBeTruthy();
});

function spokenText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return copy.textContent ?? '';
}

const SONG = {
  number: 1,
  skipped: false,
  right: ['p1'],
  anime: { english: 'Speed Line', romaji: 'Supiido Rain', japanese: 'スピードライン' },
  theme: { kind: 'OP' as const, sequence: 2 },
  song: { title: 'Full Throttle', artists: [{ name: 'Singer', as: 'Heroine' }] },
  year: 2019,
  season: 'Spring',
  slug: 'speed_line',
};

const TALLY = {
  games: 3,
  players: [
    { playerId: 'p1', wins: 2, points: 6100 },
    { playerId: 'p2', wins: 1, points: 4800 },
  ],
};

test('saves the lobby settings as a setup, and loads it into a lobby', () => {
  const { socket } = renderSeated();
  fireEvent.click(screen.getByText('Saved setups'));
  fireEvent.change(screen.getByLabelText('Save these settings as'), { target: { value: 'Short games' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Saved "Short games".')).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem('ysto_saved_settings') ?? '[]') as { name: string }[];
  expect(saved.map((setup) => setup.name)).toEqual(['Short games']);
  // The fold stays closed in jsdom, which doesn't open a details element on a click.
  fireEvent.click(screen.getByRole('button', { name: /^Load\s?Short games$/, hidden: true }));
  expect(socket.sentOfType('settings:update').at(-1)?.settings).toMatchObject({ songsPerGame: 15 });
  expect(screen.getByText('Loaded "Short games".')).toBeTruthy();
});

test("picks the player's animal in the lobby, never one another player has", () => {
  const { socket } = renderSeated();
  fireEvent.click(screen.getByText('Your animal: Fox'));
  const animals = screen.getByRole('group', { name: 'Animals' });
  expect(within(animals).getByRole('button', { name: 'Owl, taken by Ben' })).toHaveProperty('disabled', true);
  expect(within(animals).getByRole('button', { name: 'Fox' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(within(animals).getByRole('button', { name: 'Tanuki' }));
  expect(socket.sentOfType('player:icon')).toEqual([{ type: 'player:icon', icon: 'tanuki' }]);
});

test("stamps each pick at the reveal with the picker's animal, named for screen readers", () => {
  const { socket } = renderSeated(lobbyState({ game: PLAYING }));
  act(() => {
    socket.receive({ type: 'round:prepare', roundId: 'g.1', clipToken: 'c1', number: 1, rounds: 5 });
    const startsAt = Date.now() - 20_000;
    socket.receive({ type: 'round:start', roundId: 'g.1', startsAt, endsAt: startsAt + 20_000, options: OPTIONS });
    socket.receive(revealOf('g.1'));
  });
  const stamps = document.querySelectorAll('.picker-stamp');
  expect([...stamps].map((stamp) => stamp.getAttribute('title'))).toEqual(['Ben', 'Ann']);
});

test('sends a reaction from the lobby, and shows who reacted with what', () => {
  const { socket } = renderSeated();
  const bar = screen.getByRole('group', { name: 'React' });
  fireEvent.click(within(bar).getByRole('button', { name: 'Laugh' }));
  expect(socket.sentOfType('reaction')).toEqual([{ type: 'reaction', kind: 'laugh' }]);
  act(() => socket.receive({ type: 'reaction', playerId: 'p2', kind: 'heart' }));
  expect(screen.getByText('Ben: Heart')).toBeTruthy();
});

test("keeps the lobby's tally across games, in the lobby and on the results", () => {
  const { socket } = renderSeated(lobbyState({ tally: TALLY }));
  const players = screen.getByRole('list', { name: 'Players' });
  expect(within(players).getByText('2 wins')).toBeTruthy();
  expect(within(players).getByText('1 win')).toBeTruthy();
  expect(screen.getByText('3 games played in this lobby')).toBeTruthy();
  const results = [{ playerId: 'p1', score: 900, correct: 1, averageMs: null, bestStreak: 1 }];
  act(() =>
    socket.receive(
      lobbyState({ tally: TALLY, game: { phase: 'results', number: 1, rounds: 1, results, songs: [SONG] } }),
    ),
  );
  expect(screen.getByText('Game 3 in this lobby. Ann has won 2.')).toBeTruthy();
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
        songs: [SONG],
      },
    }),
  );
  expect(screen.getByRole('heading', { name: 'Final results' })).toBeTruthy();
  const standings = within(screen.getByRole('list', { name: 'Final standings' })).getAllByRole('listitem');
  // What a player is told: the winner's score counts up on screen, hidden from assistive technology.
  expect(standings.map(spokenText)).toEqual([
    '1stBen3 of 5 right · 4.2 s on average · best streak 22,400 points',
    '2ndAnnyou1 of 5 right · best streak 1900 points',
  ]);
  expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
});

test("lists the game's songs at the results, each linking to its anime on AnimeThemes", () => {
  const results = [{ playerId: 'p1', score: 900, correct: 1, averageMs: null, bestStreak: 1 }];
  renderSeated(lobbyState({ game: { phase: 'results', number: 1, rounds: 1, results, songs: [SONG] } }));
  const list = screen.getByRole('list', { name: 'Songs this game' });
  expect(within(list).getByText('Speed Line')).toBeTruthy();
  expect(within(list).getByText('OP 2 · Full Throttle · by Singer (as Heroine) · Spring 2019')).toBeTruthy();
  const link = within(list).getByRole('link', { name: 'AnimeThemes: Speed Line, opens in a new tab' });
  expect(link.getAttribute('href')).toBe('https://animethemes.moe/anime/speed_line');
  expect(link.getAttribute('rel')).toBe('noreferrer');
});

test('logs a finished game once, and shows it from the home screen with the anime heard', () => {
  const results = [
    { playerId: 'p2', score: 2400, correct: 1, averageMs: 4200, bestStreak: 1 },
    { playerId: 'p1', score: 900, correct: 1, averageMs: null, bestStreak: 1 },
  ];
  const finished = lobbyState({ game: { phase: 'results', number: 1, rounds: 1, results, songs: [SONG] } });
  const { socket } = renderSeated(finished);
  act(() => socket.receive(finished));
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Your games' }));
  const games = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem', { hidden: true });
  expect(games.filter((item) => item.classList.contains('log-game'))).toHaveLength(1);
  expect(screen.getByText('2nd of 2 · 900 points · 1 of 1 right')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Anime log (1)' }));
  const anime = screen.getByRole('list', { name: 'Anime log' });
  expect(within(anime).getByText('Heard once, right once')).toBeTruthy();
  expect(within(anime).getByRole('link', { name: 'AnimeThemes: Speed Line, opens in a new tab' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear the log' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  expect(screen.getByText(/show up here/)).toBeTruthy();
  expect(localStorage.getItem('ysto_history')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Create a lobby' })).toBeTruthy();
});

test('goes home with the reason when the host removes this player', () => {
  const { socket } = renderSeated();
  act(() => socket.closeFromServer(4001));
  expect(screen.getByRole('status').textContent).toBe('The host removed you from the lobby.');
  expect(sessionStorage.getItem('ysto_session')).toBeNull();
  expect(window.location.pathname).toBe('/');
});
