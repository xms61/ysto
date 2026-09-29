// The HTTP app: security headers on everything, the health and readiness checks, the lobby API, the clip
// route, cover art, and, when a client build exists, the built client. Client-side routes such as /j/<code> fall
// back to index.html so a join link opens the app.
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clipRouter } from './clips/route.ts';
import type { LobbyOfSession } from './clips/route.ts';
import type { ClipTokens } from './clips/tokens.ts';
import type { LobbyRegistry } from './game/registry.ts';
import { apiRouter } from './http/api.ts';
import { securityHeaders } from './http/headers.ts';
import type { Logger } from './log.ts';

export interface AppOptions {
  clientDir: string;
  coversDir: string;
  // Null while the catalog isn't loaded: the lobby routes answer 503.
  registry: LobbyRegistry | null;
  // The catalog is loaded, the audio folder is there and ffmpeg runs, so games can be played.
  ready: boolean;
  trustedProxyHops: number;
  log: Logger;
  clips?: { tokens: ClipTokens; lobbyOfSession: LobbyOfSession };
}

// index.html is read once, so page requests are answered from memory: a flood of them can't turn
// into a flood of file reads. A new build ships with a restart, which reloads it.
function serveClient(app: Express, clientDir: string) {
  const indexHtml = readFileSync(join(clientDir, 'index.html'), 'utf8');
  app.use(express.static(clientDir, { index: false }));
  app.get('/{*path}', (_req, res) => {
    res.type('html').send(indexHtml);
  });
}

export function createApp({
  clientDir,
  coversDir,
  registry,
  ready,
  trustedProxyHops,
  log,
  clips,
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/readyz', (_req, res) => {
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
  });
  app.use(apiRouter({ registry, trustedHops: trustedProxyHops }));
  if (clips) app.use(clipRouter(clips.tokens, clips.lobbyOfSession));
  // Reveals show covers; a missing one falls through to the 404 below.
  app.use('/covers', express.static(coversDir, { index: false, dotfiles: 'deny' }));
  if (existsSync(join(clientDir, 'index.html'))) serveClient(app, clientDir);
  // Express's own 404 page would replace the security headers with its own.
  app.use((_req, res) => {
    res.status(404).json({ error: 'not-found' });
  });
  // Unexpected errors get a bare 500, never a stack trace.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error('http.error', { message: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'server-error' });
  });
  return app;
}
