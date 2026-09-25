import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { ffmpegLoudness, ffprobeDuration, listAudioFiles, scanAudio } from '../../scripts/catalog/audio.ts';

// These tests generate sine tones with the ffmpeg and ffprobe on PATH; CI installs them.
const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-audio-'));
  dirs.push(dir);
  return dir;
}

function tone(root: string, relPath: string, seconds: number, volume = 1): string {
  const file = join(root, relPath);
  mkdirSync(dirname(file), { recursive: true });
  const source = `sine=frequency=440:duration=${seconds}`;
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    source,
    '-af',
    `volume=${volume}`,
    '-c:a',
    'libopus',
    file,
  ]);
  return file;
}

function countingProbe() {
  const probed: string[] = [];
  return {
    probed,
    probe: async (file: string) => {
      probed.push(file);
      return 90_000;
    },
  };
}

function scanOptions(audioDir: string, cacheDir: string, probe: (file: string) => Promise<number>) {
  return { audioDir, cacheDir, probe, concurrency: 2, log: () => {} };
}

test('lists .ogg files under the library, sorted, with forward-slash paths', () => {
  const root = tempDir();
  tone(root, '2024/Fall/B-OP1.ogg', 1);
  tone(root, '2024/Fall/A-ED1.ogg', 1);
  tone(root, '90s/C-OP1.ogg', 1);
  writeFileSync(join(root, 'notes.txt'), 'not audio');
  assert.deepEqual(
    listAudioFiles(root).map((file) => file.relPath),
    ['2024/Fall/A-ED1.ogg', '2024/Fall/B-OP1.ogg', '90s/C-OP1.ogg'],
  );
});

test('reads durations with ffprobe', async () => {
  const root = tempDir();
  const probe = ffprobeDuration('ffprobe');
  for (const seconds of [2, 3.5]) {
    const durationMs = await probe(tone(root, `tone-${seconds}.ogg`, seconds));
    assert.ok(Math.abs(durationMs - seconds * 1000) <= 60, `${seconds} s tone measured ${durationMs} ms`);
  }
});

test('probes a file once, and again only after its size or mtime changes', async () => {
  const audioDir = tempDir();
  const cacheDir = tempDir();
  tone(audioDir, 'a.ogg', 1);
  tone(audioDir, 'b.ogg', 1);
  const first = countingProbe();
  await scanAudio(scanOptions(audioDir, cacheDir, first.probe));
  assert.equal(first.probed.length, 2);

  const second = countingProbe();
  await scanAudio(scanOptions(audioDir, cacheDir, second.probe));
  assert.equal(second.probed.length, 0);

  tone(audioDir, 'b.ogg', 3);
  const third = countingProbe();
  await scanAudio(scanOptions(audioDir, cacheDir, third.probe));
  assert.deepEqual(third.probed, [join(audioDir, 'b.ogg')]);
});

test('records an unreadable file with no duration, and forgets files that are gone', async () => {
  const audioDir = tempDir();
  const cacheDir = tempDir();
  tone(audioDir, 'good.ogg', 1);
  writeFileSync(join(audioDir, 'broken.ogg'), 'not really audio');
  const files = await scanAudio(scanOptions(audioDir, cacheDir, ffprobeDuration('ffprobe')));
  assert.deepEqual(
    files.map((file) => [file.relPath, file.durationMs === null]),
    [
      ['broken.ogg', true],
      ['good.ogg', false],
    ],
  );
  rmSync(join(audioDir, 'broken.ogg'));
  const again = countingProbe();
  const remaining = await scanAudio(scanOptions(audioDir, cacheDir, again.probe));
  assert.deepEqual(
    remaining.map((file) => file.relPath),
    ['good.ogg'],
  );
  assert.equal(again.probed.length, 0);
});

test('measures integrated loudness: half the amplitude is about 6 LU quieter', async () => {
  const root = tempDir();
  const measure = ffmpegLoudness('ffmpeg');
  const loud = await measure(tone(root, 'loud.ogg', 3, 1));
  const quiet = await measure(tone(root, 'quiet.ogg', 3, 0.5));
  assert.ok(Math.abs(loud - quiet - 6.02) < 0.5, `loud ${loud} LUFS, quiet ${quiet} LUFS`);
});
