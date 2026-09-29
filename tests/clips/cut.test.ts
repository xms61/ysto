import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { clipCutter, fileInside } from '../../server/clips/cut.ts';

// These tests cut clips from a generated Ogg Opus tone with the ffmpeg and ffprobe on PATH; CI installs them.
const SOURCE = 'Season/Show-OP1.ogg';
let audioDir = '';

before(() => {
  audioDir = mkdtempSync(join(tmpdir(), 'ysto-clips-'));
  const file = join(audioDir, SOURCE);
  mkdirSync(dirname(file), { recursive: true });
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=60', '-ac', '2', '-c:a', 'libopus'],
    ...['-metadata', 'title=Secret Song', '-metadata', 'artist=Secret Artist', file],
  ]);
});
after(() => rmSync(audioDir, { recursive: true, force: true }));

interface Probe {
  format: { format_name: string; duration: string; tags?: Record<string, string> };
  streams: { codec_name: string; tags?: Record<string, string> }[];
}

function probe(audio: Buffer): Probe {
  const file = join(audioDir, 'probe.mp3');
  writeFileSync(file, audio);
  const json = execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]);
  return JSON.parse(json.toString()) as Probe;
}

test('cuts MP3 clips within 50 ms of the set length', async () => {
  const cut = clipCutter({ audioDir, ffmpegPath: 'ffmpeg', concurrency: 2 });
  for (const [startMs, lengthMs] of [
    [3000, 10_000],
    [12_345, 20_000],
    [25_000, 30_000],
  ] as const) {
    const { format, streams } = probe(await cut({ relPath: SOURCE, startMs, lengthMs }));
    assert.equal(format.format_name, 'mp3');
    assert.equal(streams[0]?.codec_name, 'mp3');
    const offMs = Math.abs(Number(format.duration) * 1000 - lengthMs);
    assert.ok(offMs < 50, `a ${lengthMs} ms clip is ${offMs.toFixed(0)} ms off`);
  }
});

test('leaves no tags in the clip, and nothing of the source metadata', async () => {
  const cut = clipCutter({ audioDir, ffmpegPath: 'ffmpeg', concurrency: 1 });
  const audio = await cut({ relPath: SOURCE, startMs: 5000, lengthMs: 10_000 });
  const { format, streams } = probe(audio);
  assert.equal(format.tags, undefined);
  assert.deepEqual(
    streams.map((stream) => stream.tags),
    [undefined],
  );
  assert.equal(audio.includes('Secret'), false, 'the source title and artist');
  assert.notEqual(audio.subarray(0, 3).toString('latin1'), 'ID3', 'an ID3v2 tag at the start');
  assert.notEqual(audio.subarray(-128, -125).toString('latin1'), 'TAG', 'an ID3v1 tag at the end');
  const firstFrame = audio.subarray(0, 200).toString('latin1');
  assert.equal(/Xing|Info|Lavc|Lavf/.test(firstFrame), false, 'a Xing header with the encoder name');
});

test('refuses paths outside the audio folder before running ffmpeg', async () => {
  const cut = clipCutter({ audioDir, ffmpegPath: 'ysto-no-such-ffmpeg', concurrency: 1 });
  for (const relPath of ['../outside.ogg', 'Season/../../outside.ogg', join(tmpdir(), 'elsewhere.ogg'), '']) {
    await assert.rejects(cut({ relPath, startMs: 0, lengthMs: 10_000 }), /is outside the audio folder/, relPath);
  }
  assert.equal(fileInside(audioDir, 'Season/..hidden.ogg'), join(audioDir, 'Season', '..hidden.ogg'));
});

test('names the file relative to the audio folder when a cut fails', async () => {
  const cut = clipCutter({ audioDir, ffmpegPath: 'ffmpeg', concurrency: 1 });
  const failure = cut({ relPath: 'Season/Missing-OP1.ogg', startMs: 0, lengthMs: 10_000 });
  await assert.rejects(failure, (error: Error) => {
    assert.match(error.message, /^Cutting Season\/Missing-OP1\.ogg failed: ffmpeg exited/);
    assert.equal(error.message.includes(audioDir), false);
    return true;
  });
});

test('rejects a clip that runs past the end of the song', async () => {
  const cut = clipCutter({ audioDir, ffmpegPath: 'ffmpeg', concurrency: 1 });
  // The tone lasts 60 s: the first cut gets half its length, the second starts after the end.
  for (const startMs of [55_000, 70_000]) {
    await assert.rejects(cut({ relPath: SOURCE, startMs, lengthMs: 10_000 }), /gave \d+% of the clip/, `${startMs}`);
  }
});
