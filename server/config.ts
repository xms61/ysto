// The only module that reads environment variables. Every variable is validated once, at startup,
// and listed in .env.example.
import { basename, dirname, join, resolve } from 'node:path';

export interface Config {
  port: number;
}

// Where the catalog scripts read and write. Relative paths resolve against the working directory,
// which is the repo root when the scripts run through npm.
export interface CatalogConfig {
  audioDir: string | null;
  catalogDir: string;
  cacheDir: string;
  ffmpegPath: string;
  ffprobePath: string;
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`PORT must be an integer from 1 to ${MAX_PORT}, got "${value}"`);
  }
  return port;
}

function optionalPath(value: string | undefined, cwd: string): string | null {
  return value === undefined || value.trim() === '' ? null : resolve(cwd, value.trim());
}

// ffprobe ships next to ffmpeg, so YSTO_FFMPEG_PATH locates both.
function ffprobeNextTo(ffmpegPath: string): string {
  const name = basename(ffmpegPath);
  if (!/^ffmpeg/i.test(name)) return 'ffprobe';
  return join(dirname(ffmpegPath), name.replace(/^ffmpeg/i, 'ffprobe'));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return { port: parsePort(env.PORT) };
}

export function loadCatalogConfig(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): CatalogConfig {
  const ffmpegPath = env.YSTO_FFMPEG_PATH?.trim() || 'ffmpeg';
  return {
    audioDir: optionalPath(env.YSTO_AUDIO_DIR, cwd),
    catalogDir: optionalPath(env.YSTO_CATALOG_DIR, cwd) ?? resolve(cwd, 'data/catalog'),
    cacheDir: optionalPath(env.YSTO_CACHE_DIR, cwd) ?? resolve(cwd, 'data/cache'),
    ffmpegPath,
    ffprobePath: ffprobeNextTo(ffmpegPath),
  };
}
