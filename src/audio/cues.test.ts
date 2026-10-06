import { expect, test } from 'vitest';
import type { GameView } from '../../shared/protocol.ts';
import { INITIAL_GAME } from '../realtime/game-state.ts';
import type { ClientRound, GameState } from '../realtime/game-state.ts';
import { lobbyState, revealOf } from '../testing/fakes.ts';
import { cuesBetween } from './cues.ts';

const PLAYING = { phase: 'playing', number: 1, rounds: 5 } as GameView;

function round(overrides: Partial<ClientRound> = {}): ClientRound {
  return {
    id: 'r1',
    number: 1,
    rounds: 5,
    clipToken: 'clip',
    start: null,
    answeredIds: [],
    choice: null,
    overtime: null,
    nudge: null,
    reveal: null,
    ...overrides,
  };
}

function playing(next: ClientRound | null): GameState {
  return { ...INITIAL_GAME, lobby: lobbyState({ game: PLAYING }), round: next };
}

test('plays nothing for the state a page loads into', () => {
  expect(cuesBetween(INITIAL_GAME, playing(round({ choice: 1 })))).toEqual([]);
});

test('deals a new round, and sounds this player’s pick and the overtime', () => {
  expect(cuesBetween(playing(null), playing(round()))).toEqual(['deal']);
  expect(cuesBetween(playing(round()), playing(round({ choice: 2 })))).toEqual(['pick']);
  expect(cuesBetween(playing(round({ choice: 2 })), playing(round({ choice: 0 })))).toEqual(['pick']);
  const overtime = { startsAt: 1, endsAt: 2 };
  expect(cuesBetween(playing(round({ choice: 0 })), playing(round({ choice: 0, overtime })))).toEqual(['overtime']);
});

test('sounds right or wrong at the reveal, wrong for a missed round, and nothing for a skipped one', () => {
  const reveal = revealOf('r1', { correct: 2 });
  expect(cuesBetween(playing(round({ choice: 2 })), playing(round({ choice: 2, reveal })))).toEqual(['right']);
  expect(cuesBetween(playing(round({ choice: 1 })), playing(round({ choice: 1, reveal })))).toEqual(['wrong']);
  expect(cuesBetween(playing(round()), playing(round({ reveal })))).toEqual(['wrong']);
  const skipped = revealOf('r1', { skipped: true });
  expect(cuesBetween(playing(round()), playing(round({ reveal: skipped })))).toEqual([]);
});

test('sounds the results once, when the game ends', () => {
  const results = { ...INITIAL_GAME, lobby: lobbyState({ game: { ...PLAYING, phase: 'results' } as GameView }) };
  expect(cuesBetween(playing(round()), results)).toEqual(['results']);
  expect(cuesBetween(results, results)).toEqual([]);
});
