// Messages from the server as they arrive on the socket.
import type { ServerMessage } from '../../shared/protocol.ts';
import { isOneOf, isRecord } from '../../shared/validate.ts';

const SERVER_TYPES = [
  'lobby:state',
  'round:prepare',
  'round:start',
  'round:answered',
  'round:switched',
  'round:overtime',
  'round:pick',
  'round:reveal',
  'game:results',
  'time:pong',
  'error',
  'server:closing',
] as const satisfies readonly ServerMessage['type'][];

// Null for anything but JSON with a known message type.
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    // The server is this app's own and builds every message from the ServerMessage types, so a known type
    // means a known shape.
    return isRecord(value) && isOneOf(value.type, SERVER_TYPES) ? (value as unknown as ServerMessage) : null;
  } catch {
    return null;
  }
}
