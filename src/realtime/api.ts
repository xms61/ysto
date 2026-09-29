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

export function createLobby(name: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, '/api/lobbies', name, (body) => (isRecord(body) ? body.code : null));
}

// `code` is already normalized (shared/protocol.ts normalizeCode).
export function joinLobby(code: string, name: string, fetchFn: Fetch = fetch): Promise<Seated> {
  return seat(fetchFn, `/api/lobbies/${encodeURIComponent(code)}/players`, name, () => code);
}
