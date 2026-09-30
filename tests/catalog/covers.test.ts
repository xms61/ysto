import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  COVER_MAX_WIDTH,
  convertCovers,
  coverFileName,
  downloadCovers,
  ffmpegCoverOptimizer,
  listCoverFiles,
} from '../../scripts/catalog/covers.ts';
import type { OptimizeCover } from '../../scripts/catalog/covers.ts';
import { fakeHttp } from './fixtures.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-covers-'));
  dirs.push(dir);
  return dir;
}

// Marks the bytes it "encodes", so the tests can see which files went through it without ffmpeg.
const markingOptimizer: OptimizeCover = async (source, target) => {
  writeFileSync(target, `webp of ${readFileSync(source).join(',')}`);
};

const failingOptimizer: OptimizeCover = async (_source, target) => {
  writeFileSync(target, 'half');
  throw new Error('ffmpeg failed');
};

const quiet = () => {};

test('names every cover after the anime id, as WebP', () => {
  assert.equal(coverFileName(20), '20.webp');
});

test('downloads only covers that are not on disk yet, and stores them as WebP', async () => {
  const coversDir = tempDir();
  writeFileSync(join(coversDir, '1.jpg'), 'old');
  const http = fakeHttp([new Response(new Uint8Array([1, 2, 3]))]);
  const covers = [
    { animeId: 1, url: 'https://img.example.test/1.jpg' },
    { animeId: 2, url: 'https://img.example.test/2.png' },
  ];
  const optimize = markingOptimizer;
  assert.deepEqual(await downloadCovers({ covers, coversDir, http, optimize, concurrency: 2, log: quiet }), {
    downloaded: 1,
    skipped: 1,
  });
  assert.equal(http.requests.length, 1);
  assert.equal(readFileSync(join(coversDir, '2.webp'), 'utf8'), 'webp of 1,2,3');
  assert.deepEqual(readdirSync(coversDir), ['1.jpg', '2.webp']);
});

test('a download that fails to encode leaves no file behind', async () => {
  const coversDir = tempDir();
  const http = fakeHttp([new Response(new Uint8Array([1]))]);
  const covers = [{ animeId: 3, url: 'https://img.example.test/3.jpg' }];
  await assert.rejects(
    downloadCovers({ covers, coversDir, http, optimize: failingOptimizer, concurrency: 1, log: quiet }),
  );
  assert.deepEqual(readdirSync(coversDir), []);
});

test('converts covers in other formats to WebP once, and removes the originals', async () => {
  const coversDir = tempDir();
  writeFileSync(join(coversDir, '1.jpg'), new Uint8Array([7]));
  writeFileSync(join(coversDir, '2.png'), new Uint8Array([8]));
  writeFileSync(join(coversDir, '3.webp'), 'already');
  const options = { coversDir, optimize: markingOptimizer, concurrency: 2, log: quiet };
  assert.deepEqual(await convertCovers(options), { converted: 2, failed: 0 });
  assert.deepEqual(readdirSync(coversDir), ['1.webp', '2.webp', '3.webp']);
  assert.equal(readFileSync(join(coversDir, '1.webp'), 'utf8'), 'webp of 7');
  assert.equal(readFileSync(join(coversDir, '3.webp'), 'utf8'), 'already');
  assert.deepEqual(await convertCovers(options), { converted: 0, failed: 0 });
});

test('a cover that fails to convert keeps its original and is logged by name', async () => {
  const coversDir = tempDir();
  writeFileSync(join(coversDir, '4.jpg'), 'old');
  const lines: string[] = [];
  const result = await convertCovers({
    coversDir,
    optimize: failingOptimizer,
    concurrency: 1,
    log: (line) => lines.push(line),
  });
  assert.deepEqual(result, { converted: 0, failed: 1 });
  assert.deepEqual(readdirSync(coversDir), ['4.jpg']);
  assert.deepEqual(lines, ['failed to convert 4.jpg']);
});

test('maps anime ids to the cover files on disk, preferring WebP and ignoring anything else', () => {
  const coversDir = tempDir();
  for (const name of ['20.jpg', '21.png', '21.webp', 'notes.txt', 'x.jpg']) writeFileSync(join(coversDir, name), '');
  assert.deepEqual(
    [...listCoverFiles(coversDir)],
    [
      [20, '20.jpg'],
      [21, '21.webp'],
    ],
  );
  assert.equal(listCoverFiles(join(coversDir, 'missing')).size, 0);
});

// Uses the ffmpeg and ffprobe on PATH; CI installs them.
function imageWidth(file: string): number {
  const args = ['-v', 'error', '-show_entries', 'stream=codec_name,width', '-of', 'csv=p=0', file];
  const [codec, width] = execFileSync('ffprobe', args, { encoding: 'utf8' }).trim().split(',');
  assert.equal(codec, 'webp');
  return Number(width);
}

test('the ffmpeg optimizer scales wide covers down to the maximum width and never enlarges small ones', async () => {
  const dir = tempDir();
  const optimize = ffmpegCoverOptimizer('ffmpeg');
  // Even widths: some ffmpeg builds drop the last column of an odd-width WebP, which doesn't matter for a cover.
  for (const [name, size, expected] of [
    ['wide.png', '900x1300', COVER_MAX_WIDTH],
    ['small.jpg', '230x330', 230],
  ] as const) {
    const source = join(dir, name);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x3355aa:s=${size}`,
      '-frames:v',
      '1',
      source,
    ]);
    await optimize(source, join(dir, `${name}.webp`));
    assert.equal(imageWidth(join(dir, `${name}.webp`)), expected);
  }
});
