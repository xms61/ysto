// The seat this tab holds. It lives in sessionStorage, so each tab is its own player and a reload keeps the
// seat (docs/SECURITY.md#sessions). The token only ever goes into the socket's hello and the clip requests'
// Authorization header, never into a URL.
import { normalizeCode } from '../../shared/protocol.ts';
import { isRecord } from '../../shared/validate.ts';
import { readJson, writeItem } from '../storage.ts';

export interface Session {
  code: string;
  playerId: string;
  sessionToken: string;
}

// Released storage keys are permanent: renaming one drops every open seat.
const SESSION_KEY = 'ysto_session';

export function readSession(storage: Storage | null): Session | null {
  const value = readJson(storage, SESSION_KEY);
  if (!isRecord(value)) return null;
  const { code, playerId, sessionToken } = value;
  if (typeof code !== 'string' || typeof playerId !== 'string' || typeof sessionToken !== 'string') return null;
  const normalized = normalizeCode(code);
  return normalized === null ? null : { code: normalized, playerId, sessionToken };
}

// Null forgets the seat.
export function writeSession(storage: Storage | null, session: Session | null): void {
  writeItem(storage, SESSION_KEY, session && JSON.stringify(session));
}
