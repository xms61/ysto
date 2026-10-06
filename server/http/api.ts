// The lobby routes (docs/design-docs/system-design.md#decision): create a lobby or join one, and get the
// session token for the socket. Anyone who has the URL can call them, so per-IP limits guard both
// (docs/SECURITY.md#input). Responses carry session tokens, so nothing here may be cached.
import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { dailyNumber } from '../../shared/daily.ts';
import { cleanName } from '../../shared/names.ts';
import { normalizeCode, parseNameBody } from '../../shared/protocol.ts';
import type { ErrorCode } from '../../shared/protocol.ts';
import { clientIp } from '../client-ip.ts';
import type { LobbyRegistry } from '../game/registry.ts';
import { RateLimit } from '../rate-limit.ts';

const MINUTE_MS = 60_000;
export const API_LIMITS = {
  creationsPerMinute: 5,
  joinsPerMinute: 30,
  unknownCodesPerMinute: 10,
  bodyBytes: 4096,
} as const;

const STATUS: Partial<Record<ErrorCode, number>> = {
  'invalid-request': 400,
  'invalid-name': 400,
  'lobby-not-found': 404,
  'name-taken': 409,
  'lobby-full': 409,
  'lobby-locked': 409,
  'too-large': 413,
  'too-many-lobbies': 429,
  'rate-limited': 429,
  'server-full': 503,
  'not-ready': 503,
  'daily-off': 404,
};

export interface ApiOptions {
  // Null while the catalog isn't loaded: the routes then answer 503.
  registry: LobbyRegistry | null;
  trustedHops: number;
  dailyOn?: boolean; // the daily challenge has its secret
  now?: () => number;
}

function fail(res: Response, error: ErrorCode, retryAfterSec?: number): void {
  if (retryAfterSec !== undefined) res.set('Retry-After', String(retryAfterSec));
  res.status(STATUS[error] ?? 400).json({ error });
}

function nameFrom(body: unknown): { name: string } | { error: 'invalid-request' | 'invalid-name' } {
  const parsed = parseNameBody(body);
  if (!parsed) return { error: 'invalid-request' };
  const name = cleanName(parsed.name);
  return name === null ? { error: 'invalid-name' } : { name };
}

// Body parser failures: too large, or not JSON.
function bodyErrors(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  if (status === 413) fail(res, 'too-large');
  else if (typeof status === 'number' && status >= 400 && status < 500) fail(res, 'invalid-request');
  else next(error);
}

export function apiRouter({ registry, trustedHops, dailyOn = false, now = Date.now }: ApiOptions): Router {
  const creations = new RateLimit(API_LIMITS.creationsPerMinute, MINUTE_MS, now);
  const joins = new RateLimit(API_LIMITS.joinsPerMinute, MINUTE_MS, now);
  const unknownCodes = new RateLimit(API_LIMITS.unknownCodesPerMinute, MINUTE_MS, now);
  const ipOf = (req: Request) => clientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'], trustedHops);
  const router = Router();
  router.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use('/api', express.json({ limit: API_LIMITS.bodyBytes }));

  router.post('/api/lobbies', (req, res) => {
    if (!registry) return fail(res, 'not-ready');
    const ip = ipOf(req);
    if (!creations.take(ip)) return fail(res, 'rate-limited', creations.retryAfterSec(ip));
    const named = nameFrom(req.body);
    if ('error' in named) return fail(res, named.error);
    const created = registry.create(named.name, ip);
    if ('error' in created) return fail(res, created.error);
    res.status(201).json(created);
  });

  // Today's daily challenge: whether it is on, and its number, for the home screen.
  router.get('/api/daily', (_req, res) => {
    res.json({ on: dailyOn && registry !== null, number: dailyNumber(now()) });
  });

  // A private one-player lobby for today's daily. It counts as a lobby created, against the same limit.
  router.post('/api/daily', (req, res) => {
    if (!registry) return fail(res, 'not-ready');
    if (!dailyOn) return fail(res, 'daily-off');
    const ip = ipOf(req);
    if (!creations.take(ip)) return fail(res, 'rate-limited', creations.retryAfterSec(ip));
    const named = nameFrom(req.body);
    if ('error' in named) return fail(res, named.error);
    const created = registry.createDaily(named.name, ip, dailyNumber(now()));
    if ('error' in created) return fail(res, created.error);
    res.status(201).json(created);
  });

  // Unknown codes count against the IP, so guessing codes runs into the limit quickly.
  router.post('/api/lobbies/:code/players', (req, res) => {
    if (!registry) return fail(res, 'not-ready');
    const ip = ipOf(req);
    if (unknownCodes.exhausted(ip)) return fail(res, 'rate-limited', unknownCodes.retryAfterSec(ip));
    if (!joins.take(ip)) return fail(res, 'rate-limited', joins.retryAfterSec(ip));
    const named = nameFrom(req.body);
    if ('error' in named) return fail(res, named.error);
    const code = normalizeCode(req.params.code);
    const joined = code === null ? { error: 'lobby-not-found' as const } : registry.join(code, named.name);
    if ('error' in joined) {
      if (joined.error === 'lobby-not-found') unknownCodes.take(ip);
      return fail(res, joined.error);
    }
    res.status(201).json(joined);
  });

  router.use('/api', bodyErrors);
  return router;
}
