import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runFfmpeg } from '../../server/clips/ffmpeg.ts';

// These tests run the ffmpeg on PATH on generated input; CI installs it.

test('returns what ffmpeg writes to stdout', async () => {
  // 0.1 s of 8 kHz mono 16-bit samples is 1,600 bytes.
  const args = ['-v', 'error', '-f', 'lavfi', '-i', 'sine=duration=0.1:sample_rate=8000', '-f', 's16le', 'pipe:1'];
  const output = await runFfmpeg('ffmpeg', args, 10_000);
  assert.equal(output.length, 1600);
});

test('rejects with the last line ffmpeg printed when it fails', async () => {
  await assert.rejects(
    runFfmpeg('ffmpeg', ['-v', 'error', '-i', 'no-such-file.ogg', '-f', 'null', '-'], 10_000),
    /ffmpeg exited with code \d+: .*No such file or directory/,
  );
});

test('stops ffmpeg when it runs past the time limit', async () => {
  // -re reads the 10 s input in real time, so only the time limit ends it early.
  const args = ['-v', 'error', '-re', '-f', 'lavfi', '-i', 'anullsrc', '-t', '10', '-f', 'null', '-'];
  const started = Date.now();
  await assert.rejects(runFfmpeg('ffmpeg', args, 300), /ffmpeg took longer than 300 ms/);
  assert.ok(Date.now() - started < 5000);
});

test('rejects when the ffmpeg binary is missing', async () => {
  await assert.rejects(runFfmpeg('ysto-no-such-ffmpeg', ['-version'], 10_000), /ENOENT/);
});
