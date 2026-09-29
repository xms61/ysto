import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clipCutter } from '../server/clips/cut.ts';

// The decode test that settled the clip format (docs/design-docs/audio-clips.md): each browser must decode
// the cutter's output through Web Audio, at the length it was cut to. It cuts a generated tone with the
// ffmpeg on PATH.
const LENGTH_MS = 20_000;
let audioDir = '';
let clipBase64 = '';

test.beforeAll(async () => {
  audioDir = mkdtempSync(join(tmpdir(), 'ysto-decode-'));
  const tone = ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-ac', '2', '-c:a', 'libopus'];
  execFileSync('ffmpeg', [...tone, join(audioDir, 'tone.ogg')]);
  const cut = clipCutter({ audioDir, ffmpegPath: 'ffmpeg', concurrency: 1 });
  clipBase64 = (await cut({ relPath: 'tone.ogg', startMs: 5000, lengthMs: LENGTH_MS })).toString('base64');
});

test.afterAll(() => rmSync(audioDir, { recursive: true, force: true }));

test('decodes a clip through Web Audio at its cut length', async ({ page }) => {
  await page.setContent('<title>decode</title>');
  const seconds = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const context = new OfflineAudioContext(2, 48_000, 48_000);
    return (await context.decodeAudioData(bytes.buffer)).duration;
  }, clipBase64);
  // The MP3 encoder adds under two frames of delay and padding.
  expect(Math.abs(seconds * 1000 - LENGTH_MS)).toBeLessThan(100);
});
