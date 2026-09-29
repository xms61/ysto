// The HTTP app: the health check, the clip route once lobbies exist (M4 passes their sessions), and, when
// a client build exists, the built client. Client-side routes such as /j/<code> fall back to index.html
// so a join link opens the app.
import express from 'express';
import type { Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clipRouter } from './clips/route.ts';
import type { LobbyOfSession } from './clips/route.ts';
import type { ClipTokens } from './clips/tokens.ts';

export interface AppOptions {
  clientDir: string;
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

export function createApp({ clientDir, clips }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  if (clips) app.use(clipRouter(clips.tokens, clips.lobbyOfSession));
  if (existsSync(join(clientDir, 'index.html'))) serveClient(app, clientDir);
  return app;
}
