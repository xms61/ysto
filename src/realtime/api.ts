// The lobby routes: create a lobby or join one, and get the seat the socket needs
// (server/realtime/REALTIME.md). Refusals come back as codes for the screens to word.
import type { ErrorCode } from '../../shared/protocol.ts';
import { isRecord } from '../../shared/validate.ts';
import { isErrorCode } from '../copy.ts';
import type { ClientErrorCode } from '../copy.ts';
import type { Session } from './session.ts';

export type Seated = { session: Session } | { error: ErrorCode | ClientErrorCode };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function postName(fetchFn: Fetch, path: string, name: string): Promise<{ status: number; body: unknown }> {
  const response = await fetchFn(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
}

function seatFrom(code: string, body: unknown): Session | null {
  if (!isRecord(body) || typeof body.playerId !== 'string' || typeof body.sessionToken !== 'string') return null;
  return { code, playerId: body.playerId, sessionToken: body.sessionToken };
}

function refusal(body: unknown): ErrorCode {
  return isRecord(body) && isErrorCode(body.error) ? body.error : 'server-error';
}

async function seat(fetchFn: Fetch, path: string, name: string, code: (body: unknown) => unknown): Promise<Seated> {
  try {
    const { status, body } = await postName(fetchFn, path, name);
    if (status !== 201) return { error: refusal(body) };
    const lobbyCode = code(body);
    const session = typeof lobbyCode === 'string' ? seatFrom(lobbyCode, body) : null;
    return session ? { session } : { error: 'server-error' };
  } catch {
    return { error: 'offline' };
  }
}

// Today's daily challenge: whether the server offers it, and its number. Off when the server can't be reached.
export async function fetchDaily(fetchFn: Fetch = fetch): Promise<{ on: boolean; number: number }> {
  try {
    const response = await fetchFn('/api/daily', { cache: 'no-store' });
    const body: unknown = await response.json();
    if (!isRecord(body)) return { on: false, number: 0 };
    const { on, number } = body;
    return typeof on === 'boolean' && typeof number === 'number' ? { on, number } : { on: false, number: 0 };
  } catch {
    return { on: false, number: 0 };
  }
}

export function createDaily(name: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, '/api/daily', name, (body) => (isRecord(body) ? body.code : null));
}

export function createLobby(name: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, '/api/lobbies', name, (body) => (isRecord(body) ? body.code : null));
}

// A party mode screen's seat in a lobby: no name, and it never plays. `code` is already normalized.
export function joinAsScreen(code: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, `/api/lobbies/${encodeURIComponent(code)}/screens`, '', () => code);
}

// `code` is already normalized (shared/protocol.ts normalizeCode).
export function joinLobby(code: string, name: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, `/api/lobbies/${encodeURIComponent(code)}/players`, name, () => code);
}
