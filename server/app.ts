// The HTTP app: the health check and, when a client build exists, the built client. Client-side
// routes such as /j/<code> fall back to index.html so a join link opens the app.
import express from 'express';
import type { Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AppOptions {
  clientDir: string;
}

function serveClient(app: Express, clientDir: string) {
  const indexFile = join(clientDir, 'index.html');
  app.use(express.static(clientDir));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(indexFile);
  });
}

export function createApp({ clientDir }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  if (existsSync(join(clientDir, 'index.html'))) serveClient(app, clientDir);
  return app;
}
