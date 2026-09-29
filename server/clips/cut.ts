// Cuts a round's clip (docs/design-docs/audio-clips.md): the chosen part of a file inside the audio folder,
// re-encoded to MP3 with short fades and no tags, so the bytes identify neither the file nor the song.
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { runFfmpeg } from './ffmpeg.ts';
import { concurrencyLimit } from './limit.ts';

export const CLIP_CONTENT_TYPE = 'audio/mpeg';
const BITRATE_KBPS = 128;
const TIMEOUT_MS = 10_000;
const FADE_IN_S = 0.3;
const FADE_OUT_S = 0.5;
// At a constant bitrate the size gives the length. A clip well short of it means the file is shorter
// than the catalog says, and a cut past the end still returns about a second.
const MIN_LENGTH_SHARE = 0.9;

// A question's clip: the file relative to YSTO_AUDIO_DIR, where the sample starts, and how long it lasts.
export interface ClipRequest {
  relPath: string;
  startMs: number;
  lengthMs: number;
}

export type CutClip = (request: ClipRequest) => Promise<Buffer>;

export interface CutterOptions {
  audioDir: string;
  ffmpegPath: string;
  concurrency: number;
}

// A bad catalog row must not make the server read outside the audio folder.
export function fileInside(audioDir: string, relPath: string): string {
  const file = resolve(audioDir, relPath);
  const path = relative(audioDir, file);
  if (path === '' || path.split(sep)[0] === '..' || isAbsolute(path)) {
    throw new Error(`${relPath} is outside the audio folder`);
  }
  return file;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

// LAME's standard quality level 5 encodes about a fifth faster than ffmpeg's default and keeps noise
// shaping, which level 7 drops. No ID3 tag and no Xing header, so the output carries no metadata and no
// encoder string.
function clipArgs(file: string, { startMs, lengthMs }: ClipRequest): string[] {
  const fades = `afade=t=in:d=${FADE_IN_S},afade=t=out:st=${seconds(lengthMs - FADE_OUT_S * 1000)}:d=${FADE_OUT_S}`;
  return [
    ...['-hide_banner', '-loglevel', 'error', '-nostdin'],
    ...['-ss', seconds(startMs), '-t', seconds(lengthMs), '-i', file],
    ...['-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1', '-af', fades],
    ...['-ac', '2', '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', `${BITRATE_KBPS}k`, '-compression_level', '5'],
    ...['-id3v2_version', '0', '-write_xing', '0', '-f', 'mp3', 'pipe:1'],
  ];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Error messages name the file relative to the audio folder, so logs never show where the library lives.
export function clipCutter({ audioDir, ffmpegPath, concurrency }: CutterOptions): CutClip {
  const limit = concurrencyLimit(concurrency);
  return async (request) => {
    const file = fileInside(audioDir, request.relPath);
    let audio: Buffer;
    try {
      audio = await limit(() => runFfmpeg(ffmpegPath, clipArgs(file, request), TIMEOUT_MS));
    } catch (error) {
      const reason = errorMessage(error).replaceAll(file, request.relPath);
      throw new Error(`Cutting ${request.relPath} failed: ${reason}`, { cause: error });
    }
    const expectedBytes = (request.lengthMs * BITRATE_KBPS) / 8;
    if (audio.length < expectedBytes * MIN_LENGTH_SHARE) {
      throw new Error(
        `Cutting ${request.relPath} gave ${Math.round((audio.length / expectedBytes) * 100)}% of the clip`,
      );
    }
    return audio;
  };
}
