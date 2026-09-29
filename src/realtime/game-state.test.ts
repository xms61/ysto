import { expect, test } from 'vitest';
import type { ServerMessage } from '../../shared/protocol.ts';
import { OPTIONS, lobbyState, revealOf } from '../testing/fakes.ts';
import { INITIAL_GAME, choose, isHost, playerOf, receive } from './game-state.ts';
import type { GameState } from './game-state.ts';

const PLAYING = { phase: 'playing', number: 1, rounds: 5, results: null } as const;
const prepare = (roundId: string): ServerMessage => ({
  type: 'round:prepare',
  roundId,
  clipToken: `clip-${roundId}`,
  number: 1,
  rounds: 5,
});
const start = (roundId: string): ServerMessage => ({
  type: 'round:start',
  roundId,
  startsAt: 10_000,
  endsAt: 30_000,
  options: OPTIONS,
});

function replay(messages: ServerMessage[], state: GameState = INITIAL_GAME): GameState {
  return messages.reduce(receive, state);
}

test('follows a round from prepare to reveal', () => {
  const state = replay([
    lobbyState({ game: PLAYING }),
    prepare('g.1'),
    start('g.1'),
    { type: 'round:answered', roundId: 'g.1', playerIds: ['p2'] },
    revealOf('g.1'),
  ]);
  expect(state.round).toMatchObject({
    id: 'g.1',
    clipToken: 'clip-g.1',
    start: { startsAt: 10_000, endsAt: 30_000, options: OPTIONS },
    answeredIds: ['p2'],
    reveal: { correct: 2 },
  });
});

test('ignores messages about any other round', () => {
  const before = replay([lobbyState({ game: PLAYING }), prepare('g.2')]);
  const after = replay(
    [start('g.1'), revealOf('g.1'), { type: 'round:answered', roundId: 'g.3', playerIds: ['p1'] }],
    before,
  );
  expect(after).toBe(before);
});

test("keeps what it knows when a reconnect repeats the round's prepare", () => {
  const answered = choose(replay([lobbyState({ game: PLAYING }), prepare('g.1'), start('g.1')]), 3);
  expect(receive(answered, prepare('g.1')).round?.choice).toBe(3);
});

test('takes one answer per round, only while the options are out', () => {
  const prepared = replay([lobbyState({ game: PLAYING }), prepare('g.1')]);
  expect(choose(prepared, 0)).toBe(prepared);
  const started = receive(prepared, start('g.1'));
  const answered = choose(started, 1);
  expect(answered.round?.choice).toBe(1);
  expect(choose(answered, 2)).toBe(answered);
  expect(choose(receive(started, revealOf('g.1')), 1).round?.choice).toBeNull();
  const answeredElsewhere = receive(started, { type: 'round:answered', roundId: 'g.1', playerIds: ['p1'] });
  expect(choose(answeredElsewhere, 1)).toBe(answeredElsewhere);
});

test('drops the round when the game ends, and reopens the results for the next game', () => {
  const playing = replay([lobbyState({ game: PLAYING }), prepare('g.1')]);
  const over = replay([{ type: 'game:results', standings: [] }], playing);
  expect(over.round).toBeNull();
  const results = lobbyState({ game: { phase: 'results', number: 5, rounds: 5, results: [] } });
  const closed = { ...receive(over, results), resultsClosed: true };
  expect(receive(closed, results).resultsClosed).toBe(true);
  expect(receive(closed, lobbyState({ game: { ...PLAYING, number: 0 } })).resultsClosed).toBe(false);
});

test('knows who this player is and whether they host', () => {
  const state = replay([lobbyState({ you: 'p2' })]);
  expect(playerOf(state)?.name).toBe('Ben');
  expect(isHost(state)).toBe(false);
  expect(isHost(replay([lobbyState()]))).toBe(true);
});
