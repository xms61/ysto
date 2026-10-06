// What the app tells players when something goes wrong: what happened, and what to do next
// (docs/DESIGN.md#ui-copy). The server sends codes; the words live here.
import type { ErrorCode } from '../shared/protocol.ts';

// A request that never reached the server.
export type ClientErrorCode = 'offline';

export const ERROR_MESSAGES: Record<ErrorCode | ClientErrorCode, string> = {
  'invalid-request': 'Something went wrong with that request. Reload the page and try again.',
  'invalid-name': 'Names need 1 to 20 characters.',
  'lobby-not-found': "That code doesn't match a lobby. Check it with the host.",
  'lobby-full': 'That lobby is full. Ask the host to make room.',
  'lobby-locked': 'That lobby is locked. Ask the host to unlock it.',
  'name-taken': 'Someone in that lobby already has that name. Pick another one.',
  'too-many-lobbies': 'Your network already has several lobbies open. Join one of them, or wait until one closes.',
  'rate-limited': 'Too many tries in a short time. Wait a minute, then try again.',
  'server-full': 'The server has no room for another lobby right now. Try again in a few minutes.',
  'not-ready': "The server can't run games right now. Try again later.",
  'too-large': 'That request was too large. Reload the page and try again.',
  'not-found': "The server doesn't know that address. Reload the page.",
  'server-error': 'Something went wrong on the server. Try again.',
  'invalid-message': "The server didn't understand that. Reload the page.",
  'not-host': 'Only the host can do that.',
  'unknown-player': 'That player already left.',
  'cannot-kick-self': "You can't remove yourself. Leave the lobby instead.",
  'game-running': 'A game is running. Change the settings once it ends.',
  'pool-too-small': 'Fewer anime match the settings than the game has songs. Widen the filters or play fewer songs.',
  'server-busy': 'The server is running as many games as it can. Try again in a few minutes.',
  'icon-taken': 'Someone just took that icon. Pick another one.',
  'unknown-team': 'That team is gone now. Pick another one.',
  'daily-off': "Today's challenge isn't available on this server.",
  'daily-fixed': "The daily challenge's settings can't change.",
  offline: "Couldn't reach the server. Check your connection and try again.",
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value !== 'offline' && Object.hasOwn(ERROR_MESSAGES, value);
}
