// The lobby and its game as this client knows them, folded from the server's messages by a pure reducer,
// so tests can replay message sequences (docs/product-specs/game-flow.md). Times are server times.
import type {
  LobbyState,
  OptionTitles,
  PlayerView,
  RoundAsk,
  RoundHint,
  RoundReveal,
  ServerMessage,
  TitleMatch,
} from '../../shared/protocol.ts';
import { answersCanChange } from '../../shared/settings.ts';

export interface RoundStart {
  startsAt: number;
  endsAt: number;
  options: OptionTitles;
  ask: RoundAsk; // what the options name
}

export interface ClientRound {
  id: string;
  number: number;
  rounds: number | null; // null in an endless game
  clipToken: string;
  start: RoundStart | null; // null until round:start
  answeredIds: string[];
  choice: number | null; // this player's answer, once sent; with answer changes on, the latest
  overtime: { startsAt: number; endsAt: number } | null; // with answer changes on, once everyone has answered
  nudge: { playerId: string; count: number } | null; // the last player to switch, and how many switches so far
  hint: RoundHint | null; // when the anime aired, once this player has taken the hint
  typed: TitleMatch | null; // with typing: the anime this player answered; with answer changes on, the latest
  reveal: RoundReveal | null;
}

export interface GameState {
  lobby: LobbyState | null;
  round: ClientRound | null; // the round of the running game, while there is one
  resultsClosed: boolean; // the player went back to the lobby from the last game's results
  reported: number[]; // the rounds of this game whose clip the player reported
}

export const INITIAL_GAME: GameState = { lobby: null, round: null, resultsClosed: false, reported: [] };

type RoundMessage = Extract<ServerMessage, { roundId: string }>;

function onLobby(state: GameState, lobby: LobbyState): GameState {
  const playing = lobby.game?.phase === 'playing';
  const newGame = playing && state.lobby?.game?.phase !== 'playing';
  return {
    lobby,
    round: playing ? state.round : null,
    resultsClosed: newGame ? false : state.resultsClosed,
    reported: newGame ? [] : state.reported,
  };
}

// A reconnect repeats the round in progress, which keeps what this client already knows about it.
function onPrepare(state: GameState, message: Extract<ServerMessage, { type: 'round:prepare' }>): GameState {
  if (state.round?.id === message.roundId) return state;
  const { roundId: id, number, rounds, clipToken } = message;
  return {
    ...state,
    round: {
      id,
      number,
      rounds,
      clipToken,
      start: null,
      answeredIds: [],
      choice: null,
      overtime: null,
      nudge: null,
      hint: null,
      typed: null,
      reveal: null,
    },
  };
}

function onRound(state: GameState, message: RoundMessage): GameState {
  const round = state.round;
  if (!round || round.id !== message.roundId) return state;
  if (message.type === 'round:start') {
    const { startsAt, endsAt, options, ask = 'anime' } = message;
    return { ...state, round: { ...round, start: { startsAt, endsAt, options, ask } } };
  }
  if (message.type === 'round:answered') return { ...state, round: { ...round, answeredIds: message.playerIds } };
  if (message.type === 'round:switched') {
    const nudge = { playerId: message.playerId, count: (round.nudge?.count ?? 0) + 1 };
    return { ...state, round: { ...round, nudge } };
  }
  if (message.type === 'round:overtime') {
    const { startsAt, endsAt } = message;
    return { ...state, round: { ...round, overtime: { startsAt, endsAt } } };
  }
  if (message.type === 'round:pick') return { ...state, round: { ...round, choice: message.option } };
  if (message.type === 'round:typed') return { ...state, round: { ...round, typed: message.match } };
  if (message.type === 'round:hint') {
    const { format, season, year } = message;
    return { ...state, round: { ...round, hint: { format, season, year } } };
  }
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
    case 'round:switched':
    case 'round:overtime':
    case 'round:pick':
    case 'round:hint':
    case 'round:typed':
    case 'round:reveal':
      return onRound(state, message);
    case 'game:results':
      return { ...state, round: null };
    default:
      return state;
  }
}

// This player's answer, once the options are out and before the reveal: one per round, or with answer
// changes on, any other option until the round closes.
export function choose(state: GameState, option: number): GameState {
  const { round, lobby } = state;
  if (!round?.start || round.reveal || round.choice === option) return state;
  const answered = round.choice !== null || (lobby !== null && round.answeredIds.includes(lobby.you));
  if (answered && !(lobby && answersCanChange(lobby.settings))) return state;
  return { ...state, round: { ...round, choice: option } };
}

// This player's typed answer, under the same rules as a tapped one.
export function chooseTyped(state: GameState, match: TitleMatch): GameState {
  const { round, lobby } = state;
  if (!round?.start || round.reveal || round.typed?.animeId === match.animeId) return state;
  const answered = round.typed !== null || (lobby !== null && round.answeredIds.includes(lobby.you));
  if (answered && !(lobby && answersCanChange(lobby.settings))) return state;
  return { ...state, round: { ...round, typed: match } };
}

export function playerOf(state: GameState): PlayerView | null {
  const lobby = state.lobby;
  return lobby?.players.find((player) => player.id === lobby.you) ?? null;
}

export function isHost(state: GameState): boolean {
  return state.lobby !== null && state.lobby.hostId === state.lobby.you;
}
