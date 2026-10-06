// Starts the server: loads the config and the catalog, checks the clip service, serves the app and the lobby
// sockets, and on SIGINT or SIGTERM tells the players and closes cleanly.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadCatalog } from './catalog/load.ts';
import type { Catalog } from './catalog/load.ts';
import { clipCutter } from './clips/cut.ts';
import type { CutClip } from './clips/cut.ts';
import { runFfmpeg } from './clips/ffmpeg.ts';
import { ClipTokens } from './clips/tokens.ts';
import { loadConfig } from './config.ts';
import type { Config } from './config.ts';
import { Games } from './game/games.ts';
import { secureRandom } from './game/random.ts';
import { LobbyRegistry } from './game/registry.ts';
import { createLogger } from './log.ts';
import type { Logger } from './log.ts';
import { Realtime } from './realtime/hub.ts';
import { systemScheduler } from './scheduler.ts';
import { openReports } from './reports.ts';

const CLIENT_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
// Sockets and requests get this long to finish before the process exits anyway.
const SHUTDOWN_GRACE_MS = 5000;
const FFMPEG_CHECK_MS = 5000;

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

// Games need the audio folder and a working ffmpeg; without them lobbies still open, but no game starts.
async function clipServiceOrNull(config: Config, log: Logger): Promise<{ cut: CutClip; tokens: ClipTokens } | null> {
  const { audioDir, ffmpegPath, ffmpegConcurrency } = config;
  if (audioDir === null || !existsSync(audioDir)) {
    log.error('audio.unavailable', { message: 'YSTO_AUDIO_DIR is not set, or the folder does not exist' });
    return null;
  }
  try {
    await runFfmpeg(ffmpegPath, ['-hide_banner', '-version'], FFMPEG_CHECK_MS);
  } catch (error) {
    log.error('ffmpeg.unavailable', { message: errorMessage(error) });
    return null;
  }
  return { cut: clipCutter({ audioDir, ffmpegPath, concurrency: ffmpegConcurrency }), tokens: new ClipTokens() };
}

const config = loadConfigOrExit();
const log = createLogger(config.logLevel);
const catalog = loadCatalogOrNull(config.catalogDir, log);
const clips = await clipServiceOrNull(config, log);
const reports = openReports(config.stateDir, log);
const registry =
  catalog && new LobbyRegistry({ catalog, maxLobbies: config.maxLobbies, maxPlayers: config.maxPlayers, log });
const games =
  catalog &&
  registry &&
  new Games({
    registry,
    catalog,
    clips,
    maxGames: config.maxGames,
    scheduler: systemScheduler,
    random: secureRandom,
    log,
    reports,
    dailySecret: config.dailySecret,
  });
const clipRoute = registry &&
  clips && { tokens: clips.tokens, lobbyOfSession: (token: string) => registry.seatOf(token)?.code };
const app = createApp({
  clientDir: CLIENT_DIR,
  coversDir: join(config.catalogDir, 'covers'),
  registry,
  ready: registry !== null && clips !== null,
  trustedProxyHops: config.trustedProxyHops,
  dailyOn: config.dailySecret !== null,
  log,
  ...(clipRoute && { clips: clipRoute }),
});
const server = app.listen(config.port, () => log.info('server.listening', { port: config.port }));
const realtime =
  registry &&
  games &&
  new Realtime(server, {
    registry,
    games,
    allowedOrigins: config.allowedOrigins,
    trustedHops: config.trustedProxyHops,
    log,
  });

function shutDown(signal: string): void {
  log.info('server.closing', { signal });
  realtime?.close();
  server.close(() => {
    reports.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => shutDown(signal));
}
