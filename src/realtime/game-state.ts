// The lobby and its game as this client knows them, folded from the server's messages by a pure reducer,
// so tests can replay message sequences (docs/product-specs/game-flow.md). Times are server times.
import type { LobbyState, OptionTitles, PlayerView, RoundReveal, ServerMessage } from '../../shared/protocol.ts';

export interface RoundStart {
  startsAt: number;
  endsAt: number;
  options: OptionTitles;
}

export interface ClientRound {
  id: string;
  number: number;
  rounds: number;
  clipToken: string;
  start: RoundStart | null; // null until round:start
  answeredIds: string[];
  choice: number | null; // this player's answer, once sent
  reveal: RoundReveal | null;
}

export interface GameState {
  lobby: LobbyState | null;
  round: ClientRound | null; // the round of the running game, while there is one
  resultsClosed: boolean; // the player went back to the lobby from the last game's results
}

export const INITIAL_GAME: GameState = { lobby: null, round: null, resultsClosed: false };

type RoundMessage = Extract<ServerMessage, { roundId: string }>;

function onLobby(state: GameState, lobby: LobbyState): GameState {
  const playing = lobby.game?.phase === 'playing';
  const newGame = playing && state.lobby?.game?.phase !== 'playing';
  return {
    lobby,
    round: playing ? state.round : null,
    resultsClosed: newGame ? false : state.resultsClosed,
  };
}

// A reconnect repeats the round in progress, which keeps what this client already knows about it.
function onPrepare(state: GameState, message: Extract<ServerMessage, { type: 'round:prepare' }>): GameState {
  if (state.round?.id === message.roundId) return state;
  const { roundId: id, number, rounds, clipToken } = message;
  return {
    ...state,
    round: { id, number, rounds, clipToken, start: null, answeredIds: [], choice: null, reveal: null },
  };
}

function onRound(state: GameState, message: RoundMessage): GameState {
  const round = state.round;
  if (!round || round.id !== message.roundId) return state;
  if (message.type === 'round:start') {
    const { startsAt, endsAt, options } = message;
    return { ...state, round: { ...round, start: { startsAt, endsAt, options } } };
  }
  if (message.type === 'round:answered') return { ...state, round: { ...round, answeredIds: message.playerIds } };
  if (message.type === 'round:reveal') return { ...state, round: { ...round, reveal: message } };
  return state;
}

export function receive(state: GameState, message: ServerMessage): GameState {
  switch (message.type) {
    case 'lobby:state':
      return onLobby(state, message);
    case 'round:prepare':
      return onPrepare(state, message);
    case 'round:start':
    case 'round:answered':
    case 'round:reveal':
      return onRound(state, message);
    case 'game:results':
      return { ...state, round: null };
    default:
      return state;
  }
}

// This player's answer: one per round, once the options are out and before the reveal.
export function choose(state: GameState, option: number): GameState {
  const round = state.round;
  if (!round?.start || round.reveal || round.choice !== null) return state;
  if (state.lobby && round.answeredIds.includes(state.lobby.you)) return state;
  return { ...state, round: { ...round, choice: option } };
}

export function playerOf(state: GameState): PlayerView | null {
  const lobby = state.lobby;
  return lobby?.players.find((player) => player.id === lobby.you) ?? null;
}

export function isHost(state: GameState): boolean {
  return state.lobby !== null && state.lobby.hostId === state.lobby.you;
}
