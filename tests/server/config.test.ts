import assert from 'node:assert/strict';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { loadCatalogConfig, loadConfig } from '../../server/config.ts';

const CWD = resolve('repo-root');

test('defaults the port to 3000', () => {
  assert.equal(loadConfig({}).port, 3000);
  assert.equal(loadConfig({ PORT: '' }).port, 3000);
});

test('reads PORT', () => {
  assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
});

test('rejects a PORT that is not a port number', () => {
  for (const value of ['0', '65536', 'abc', '3000.5']) {
    assert.throws(() => loadConfig({ PORT: value }), {
      message: `PORT must be an integer from 1 to 65535, got "${value}"`,
    });
  }
});

test('defaults the server settings', () => {
  assert.deepEqual(loadConfig({}, CWD), {
    port: 3000,
    logLevel: 'info',
    catalogDir: resolve(CWD, 'data/catalog'),
    audioDir: null,
    ffmpegPath: 'ffmpeg',
    ffmpegConcurrency: Math.max(1, availableParallelism() - 1),
    trustedProxyHops: 0,
    allowedOrigins: [],
    maxLobbies: 100,
    maxPlayers: 12,
    maxGames: 30,
  });
});

test('reads the server settings', () => {
  const config = loadConfig(
    {
      LOG_LEVEL: 'warn',
      YSTO_CATALOG_DIR: 'catalog',
      YSTO_TRUST_PROXY: '1',
      YSTO_ALLOWED_ORIGINS: 'https://example.org, http://localhost:5173',
      YSTO_MAX_LOBBIES: '20',
      YSTO_MAX_PLAYERS: '8',
      YSTO_AUDIO_DIR: 'library',
      YSTO_FFMPEG_PATH: 'tools/ffmpeg',
      YSTO_FFMPEG_CONCURRENCY: '2',
      YSTO_MAX_GAMES: '4',
    },
    CWD,
  );
  assert.deepEqual(config, {
    port: 3000,
    logLevel: 'warn',
    catalogDir: resolve(CWD, 'catalog'),
    audioDir: resolve(CWD, 'library'),
    ffmpegPath: 'tools/ffmpeg',
    ffmpegConcurrency: 2,
    trustedProxyHops: 1,
    allowedOrigins: ['https://example.org', 'http://localhost:5173'],
    maxLobbies: 20,
    maxPlayers: 8,
    maxGames: 4,
  });
});

test('names the variable when a server setting is invalid', () => {
  const CASES: [Record<string, string>, RegExp][] = [
    [{ LOG_LEVEL: 'verbose' }, /^LOG_LEVEL must be one of debug, info, warn, error, got "verbose"$/],
    [{ YSTO_TRUST_PROXY: '-1' }, /^YSTO_TRUST_PROXY must be an integer from 0 to 10/],
    [{ YSTO_MAX_LOBBIES: '0' }, /^YSTO_MAX_LOBBIES must be an integer from 1/],
    [{ YSTO_MAX_PLAYERS: 'many' }, /^YSTO_MAX_PLAYERS must be an integer from 1 to 50/],
    [{ YSTO_FFMPEG_CONCURRENCY: '0' }, /^YSTO_FFMPEG_CONCURRENCY must be an integer from 1 to 64/],
    [{ YSTO_MAX_GAMES: '1.5' }, /^YSTO_MAX_GAMES must be an integer from 1 to 1000/],
    [{ YSTO_ALLOWED_ORIGINS: 'https://example.org/path' }, /^YSTO_ALLOWED_ORIGINS holds "https:\/\/example.org\/path"/],
    [{ YSTO_ALLOWED_ORIGINS: 'example.org' }, /^YSTO_ALLOWED_ORIGINS holds "example.org"/],
  ];
  for (const [env, message] of CASES) assert.throws(() => loadConfig(env, CWD), { message });
});

test('defaults the catalog paths to data/ under the working directory', () => {
  assert.deepEqual(loadCatalogConfig({}, CWD), {
    audioDir: null,
    catalogDir: resolve(CWD, 'data/catalog'),
    cacheDir: resolve(CWD, 'data/cache'),
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
  });
});

test('resolves catalog paths from the environment, treating blank values as unset', () => {
  const config = loadCatalogConfig({ YSTO_AUDIO_DIR: 'library', YSTO_CATALOG_DIR: ' ', YSTO_CACHE_DIR: 'cache' }, CWD);
  assert.equal(config.audioDir, resolve(CWD, 'library'));
  assert.equal(config.catalogDir, resolve(CWD, 'data/catalog'));
  assert.equal(config.cacheDir, resolve(CWD, 'cache'));
});

test('finds ffprobe next to the configured ffmpeg', () => {
  const tools = join('tools', 'bin');
  assert.equal(
    loadCatalogConfig({ YSTO_FFMPEG_PATH: join(tools, 'ffmpeg.exe') }, CWD).ffprobePath,
    join(tools, 'ffprobe.exe'),
  );
  assert.equal(loadCatalogConfig({ YSTO_FFMPEG_PATH: join(tools, 'avconv') }, CWD).ffprobePath, 'ffprobe');
});
