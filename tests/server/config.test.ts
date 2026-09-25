import assert from 'node:assert/strict';
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
