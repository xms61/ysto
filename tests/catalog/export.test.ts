import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { exportLibrary, ffmpegEncoder } from '../../scripts/catalog/export.ts';
import type { EncodeFile } from '../../scripts/catalog/export.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-export-'));
  dirs.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content = 'audio'): string {
  const file = join(root, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

// Copies the source, so the tests can see what was encoded without ffmpeg.
function copyingEncoder() {
  const encoded: string[] = [];
  const encode: EncodeFile = async (source, target) => {
    encoded.push(source);
    writeFileSync(target, `copy of ${readFileSync(source, 'utf8')}`);
  };
  return { encoded, encode };
}

function setup() {
  const root = tempDir();
  return { audioDir: join(root, 'library'), exportDir: join(root, 'export') };
}

const quiet = () => {};

test('encodes each playable file to the same relative path', async () => {
  const { audioDir, exportDir } = setup();
  writeFile(audioDir, 'a/one.ogg', 'one');
  writeFile(audioDir, 'two.ogg', 'two');
  writeFile(audioDir, 'unplayed.ogg');
  const { encode } = copyingEncoder();
  const relPaths = ['a/one.ogg', 'two.ogg'];
  const report = await exportLibrary({ audioDir, exportDir, relPaths, encode, concurrency: 2, log: quiet });
  assert.deepEqual(report, { encoded: 2, unchanged: 0, removed: 0, failed: 0 });
  assert.equal(readFileSync(join(exportDir, 'a/one.ogg'), 'utf8'), 'copy of one');
  assert.equal(readFileSync(join(exportDir, 'two.ogg'), 'utf8'), 'copy of two');
  assert.equal(existsSync(join(exportDir, 'unplayed.ogg')), false);
});

test('a rerun encodes only changed files and removes copies the catalog no longer plays', async () => {
  const { audioDir, exportDir } = setup();
  writeFile(audioDir, 'kept.ogg');
  const changed = writeFile(audioDir, 'changed.ogg');
  writeFile(audioDir, 'dropped.ogg');
  const first = copyingEncoder();
  const relPaths = ['kept.ogg', 'changed.ogg', 'dropped.ogg'];
  await exportLibrary({ audioDir, exportDir, relPaths, encode: first.encode, concurrency: 1, log: quiet });
  const later = new Date(Date.now() + 60_000);
  utimesSync(changed, later, later);

  const second = copyingEncoder();
  const report = await exportLibrary({
    audioDir,
    exportDir,
    relPaths: ['kept.ogg', 'changed.ogg'],
    encode: second.encode,
    concurrency: 1,
    log: quiet,
  });
  assert.deepEqual(report, { encoded: 1, unchanged: 1, removed: 1, failed: 0 });
  assert.deepEqual(second.encoded, [changed]);
  assert.equal(existsSync(join(exportDir, 'dropped.ogg')), false);
});

test('a failed or missing file is counted and logged without its path, and leaves no partial file', async () => {
  const { audioDir, exportDir } = setup();
  writeFile(audioDir, 'broken.ogg');
  const lines: string[] = [];
  const encode: EncodeFile = async (_source, target) => {
    writeFileSync(target, 'half');
    throw new Error(`ffmpeg failed on ${audioDir}`);
  };
  const relPaths = ['broken.ogg', 'missing.ogg'];
  const report = await exportLibrary({
    audioDir,
    exportDir,
    relPaths,
    encode,
    concurrency: 1,
    log: (line) => lines.push(line),
  });
  assert.deepEqual(report, { encoded: 0, unchanged: 0, removed: 0, failed: 2 });
  assert.deepEqual(lines, ['failed: broken.ogg', 'failed: missing.ogg']);
  assert.equal(existsSync(join(exportDir, 'broken.ogg')), false);
  assert.equal(existsSync(join(exportDir, 'broken.ogg.part')), false);
});

test('refuses an export folder inside the library, or one that contains it', async () => {
  const root = tempDir();
  const { encode } = copyingEncoder();
  const message = /^YSTO_EXPORT_DIR must be outside YSTO_AUDIO_DIR/;
  for (const [audioDir, exportDir] of [
    [root, join(root, 'export')],
    [join(root, 'library'), root],
    [root, root],
  ] as const) {
    await assert.rejects(exportLibrary({ audioDir, exportDir, relPaths: [], encode, concurrency: 1, log: quiet }), {
      message,
    });
  }
});

// Uses the ffmpeg and ffprobe on PATH; CI installs them.
test('the ffmpeg encoder writes Opus without the source tags', async () => {
  const dir = tempDir();
  const source = join(dir, 'source.ogg');
  const target = join(dir, 'target.ogg');
  const tone = ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libopus'];
  execFileSync('ffmpeg', [...tone, '-b:a', '256k', '-metadata', 'title=Secret Song', source]);
  await ffmpegEncoder('ffmpeg')(source, target);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', target], {
    encoding: 'utf8',
  });
  const { streams, format } = JSON.parse(probe) as {
    streams: { codec_name: string; tags?: Record<string, string> }[];
    format: { tags?: Record<string, string> };
  };
  assert.equal(streams[0]?.codec_name, 'opus');
  assert.equal(JSON.stringify([streams, format]).includes('Secret Song'), false);
});
