// The only module that reads environment variables. Every variable is validated once, at startup,
// and listed in .env.example.
import { availableParallelism } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { LOG_LEVELS } from './log.ts';
import type { LogLevel } from './log.ts';

// What the server needs. Relative paths resolve against the working directory.
export interface Config {
  port: number;
  logLevel: LogLevel;
  catalogDir: string;
  audioDir: string | null; // games can't start without it
  ffmpegPath: string;
  ffmpegConcurrency: number;
  trustedProxyHops: number;
  allowedOrigins: string[];
  maxLobbies: number;
  maxPlayers: number;
  maxGames: number;
}

// Where the catalog scripts read and write. Relative paths resolve against the working directory,
// which is the repo root when the scripts run through npm.
export interface CatalogConfig {
  audioDir: string | null;
  catalogDir: string;
  cacheDir: string;
  exportDir: string; // the re-encoded copy of the library that goes to the VPS
  ffmpegPath: string;
  ffprobePath: string;
}

type Env = NodeJS.ProcessEnv;

function setValue(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function integerIn(env: Env, name: string, min: number, max: number, fallback: number): number {
  const value = setValue(env, name);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}, got "${value}"`);
  }
  return number;
}

function logLevel(env: Env): LogLevel {
  const value = setValue(env, 'LOG_LEVEL') ?? 'info';
  const level = LOG_LEVELS.find((candidate) => candidate === value);
  if (!level) throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${value}"`);
  return level;
}

// A comma-separated list of origins such as https://example.org, each without a path.
function allowedOrigins(env: Env): string[] {
  const entries = (setValue(env, 'YSTO_ALLOWED_ORIGINS') ?? '').split(',').map((entry) => entry.trim());
  return entries
    .filter((entry) => entry !== '')
    .map((entry) => {
      const origin = URL.canParse(entry) ? new URL(entry).origin : null;
      if (origin !== entry) {
        throw new Error(`YSTO_ALLOWED_ORIGINS holds "${entry}", which is not an origin like https://example.org`);
      }
      return origin;
    });
}

function optionalPath(env: Env, name: string, cwd: string): string | null {
  const value = setValue(env, name);
  return value === undefined ? null : resolve(cwd, value);
}

function catalogDir(env: Env, cwd: string): string {
  return optionalPath(env, 'YSTO_CATALOG_DIR', cwd) ?? resolve(cwd, 'data/catalog');
}

function ffmpegPath(env: Env): string {
  return setValue(env, 'YSTO_FFMPEG_PATH') ?? 'ffmpeg';
}

// ffprobe ships next to ffmpeg, so YSTO_FFMPEG_PATH locates both.
function ffprobeNextTo(ffmpegPath: string): string {
  const name = basename(ffmpegPath);
  if (!/^ffmpeg/i.test(name)) return 'ffprobe';
  return join(dirname(ffmpegPath), name.replace(/^ffmpeg/i, 'ffprobe'));
}

export function loadConfig(env: Env = process.env, cwd: string = process.cwd()): Config {
  return {
    port: integerIn(env, 'PORT', 1, 65535, 3000),
    logLevel: logLevel(env),
    catalogDir: catalogDir(env, cwd),
    audioDir: optionalPath(env, 'YSTO_AUDIO_DIR', cwd),
    ffmpegPath: ffmpegPath(env),
    // One core stays free for the event loop.
    ffmpegConcurrency: integerIn(env, 'YSTO_FFMPEG_CONCURRENCY', 1, 64, Math.max(1, availableParallelism() - 1)),
    trustedProxyHops: integerIn(env, 'YSTO_TRUST_PROXY', 0, 10, 0),
    allowedOrigins: allowedOrigins(env),
    maxLobbies: integerIn(env, 'YSTO_MAX_LOBBIES', 1, 10_000, 100),
    maxPlayers: integerIn(env, 'YSTO_MAX_PLAYERS', 1, 50, 12),
    maxGames: integerIn(env, 'YSTO_MAX_GAMES', 1, 1000, 30),
  };
}

export function loadCatalogConfig(env: Env = process.env, cwd: string = process.cwd()): CatalogConfig {
  const ffmpeg = ffmpegPath(env);
  return {
    audioDir: optionalPath(env, 'YSTO_AUDIO_DIR', cwd),
    catalogDir: catalogDir(env, cwd),
    cacheDir: optionalPath(env, 'YSTO_CACHE_DIR', cwd) ?? resolve(cwd, 'data/cache'),
    exportDir: optionalPath(env, 'YSTO_EXPORT_DIR', cwd) ?? resolve(cwd, 'data/export'),
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobeNextTo(ffmpeg),
  };
}
