// Starts the server: loads the config and the catalog, serves the app and the lobby sockets, and on SIGINT
// or SIGTERM tells the players and closes cleanly.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadCatalog } from './catalog/load.ts';
import type { Catalog } from './catalog/load.ts';
import { ClipTokens } from './clips/tokens.ts';
import { loadConfig } from './config.ts';
import type { Config } from './config.ts';
import { LobbyRegistry } from './game/registry.ts';
import { createLogger } from './log.ts';
import type { Logger } from './log.ts';
import { Realtime } from './realtime/hub.ts';

const CLIENT_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
// Sockets and requests get this long to finish before the process exits anyway.
const SHUTDOWN_GRACE_MS = 5000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (error) {
    console.error(`Invalid configuration: ${errorMessage(error)}`);
    process.exit(1);
  }
}

// Without a catalog the process stays up, so /readyz can report it, but no lobby can open.
function loadCatalogOrNull(catalogDir: string, log: Logger): Catalog | null {
  try {
    return loadCatalog(join(catalogDir, 'catalog.sqlite'));
  } catch (error) {
    log.error('catalog.unavailable', { message: errorMessage(error) });
    return null;
  }
}

const config = loadConfigOrExit();
const log = createLogger(config.logLevel);
const catalog = loadCatalogOrNull(config.catalogDir, log);
const registry =
  catalog && new LobbyRegistry({ catalog, maxLobbies: config.maxLobbies, maxPlayers: config.maxPlayers, log });
const clips = registry && { tokens: new ClipTokens(), lobbyOfSession: (token: string) => registry.seatOf(token)?.code };
const app = createApp({
  clientDir: CLIENT_DIR,
  registry,
  trustedProxyHops: config.trustedProxyHops,
  log,
  ...(clips && { clips }),
});
const server = app.listen(config.port, () => log.info('server.listening', { port: config.port }));
const realtime =
  registry &&
  new Realtime(server, {
    registry,
    allowedOrigins: config.allowedOrigins,
    trustedHops: config.trustedProxyHops,
    log,
  });

function shutDown(signal: string): void {
  log.info('server.closing', { signal });
  realtime?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => shutDown(signal));
}
