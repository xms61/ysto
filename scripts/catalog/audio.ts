// The audio library on disk: which files exist, how long each one is (ffprobe, cached by path, size
// and mtime), and how loud a file is (ffmpeg's ebur128 filter). Nothing here writes to the library.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';
import { forEachConcurrent } from './concurrency.ts';
import { isRecord, numberOrNull } from './fields.ts';
import { readJsonFile, writeJsonFile } from './json-files.ts';

const run = promisify(execFile);

export interface AudioFile {
  relPath: string;
  size: number;
  mtimeMs: number;
}

export interface ProbedFile extends AudioFile {
  durationMs: number | null; // null when ffprobe could not read the file
}

export type ProbeDuration = (absolutePath: string) => Promise<number>;
export type MeasureLoudness = (absolutePath: string) => Promise<number>;

interface ScanOptions {
  audioDir: string;
  cacheDir: string;
  probe: ProbeDuration;
  concurrency: number;
  log: (line: string) => void;
}

type ProbeCache = Record<string, { size: number; mtimeMs: number; durationMs: number | null }>;

const SAVE_EVERY = 500;
const FFMPEG_OUTPUT_LIMIT = 16 * 1024 * 1024;

export function listAudioFiles(audioDir: string): AudioFile[] {
  const relPaths = readdirSync(audioDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.toLowerCase().endsWith('.ogg'))
    .map((path) => path.split(sep).join('/'))
    .sort();
  return relPaths.flatMap((relPath) => {
    const stats = statSync(join(audioDir, relPath));
    return stats.isFile() ? [{ relPath, size: stats.size, mtimeMs: Math.round(stats.mtimeMs) }] : [];
  });
}

export function ffprobeDuration(ffprobePath: string): ProbeDuration {
  return async (file) => {
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file];
    const { stdout } = await run(ffprobePath, args);
    const seconds = Number(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('ffprobe reported no duration');
    return Math.round(seconds * 1000);
  };
}

export function ffmpegLoudness(ffmpegPath: string): MeasureLoudness {
  return async (file) => {
    const args = ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'];
    const { stderr } = await run(ffmpegPath, args, { maxBuffer: FFMPEG_OUTPUT_LIMIT });
    const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
    const match = /I:\s+(-?\d+(?:\.\d+)?) LUFS/.exec(summary);
    if (!match?.[1]) throw new Error('ffmpeg reported no integrated loudness');
    return Number(match[1]);
  };
}

function readProbeCache(file: string): ProbeCache {
  if (!existsSync(file)) return {};
  const raw = readJsonFile(file);
  if (!isRecord(raw)) return {};
  const cache: ProbeCache = {};
  for (const [relPath, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) continue;
    const size = numberOrNull(entry.size);
    const mtimeMs = numberOrNull(entry.mtimeMs);
    if (size !== null && mtimeMs !== null) {
      cache[relPath] = { size, mtimeMs, durationMs: numberOrNull(entry.durationMs) };
    }
  }
  return cache;
}

async function probeOrNull(probe: ProbeDuration, file: string): Promise<number | null> {
  try {
    return await probe(file);
  } catch {
    return null;
  }
}

// Probes every file whose size or mtime changed since the last scan, saving progress as it goes, so an
// interrupted scan resumes. Entries for files that no longer exist are dropped.
export async function scanAudio(options: ScanOptions): Promise<ProbedFile[]> {
  const cacheFile = join(options.cacheDir, 'audio', 'probes.json');
  const cache = readProbeCache(cacheFile);
  const files = listAudioFiles(options.audioDir);
  const stale = files.filter((file) => {
    const cached = cache[file.relPath];
    return !cached || cached.size !== file.size || cached.mtimeMs !== file.mtimeMs;
  });
  options.log(`${files.length} files, ${stale.length} to probe`);
  let probed = 0;
  await forEachConcurrent(stale, options.concurrency, async (file) => {
    const durationMs = await probeOrNull(options.probe, join(options.audioDir, file.relPath));
    cache[file.relPath] = { size: file.size, mtimeMs: file.mtimeMs, durationMs };
    probed++;
    if (probed % SAVE_EVERY === 0) {
      writeJsonFile(cacheFile, cache);
      options.log(`probed ${probed}/${stale.length}`);
    }
  });
  const current: ProbeCache = {};
  for (const file of files) {
    const entry = cache[file.relPath];
    if (entry) current[file.relPath] = entry;
  }
  writeJsonFile(cacheFile, current);
  return files.map((file) => ({ ...file, durationMs: current[file.relPath]?.durationMs ?? null }));
}
