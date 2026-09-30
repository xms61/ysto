// The copy of the library that the VPS serves: every file the catalog plays, re-encoded to 128 kbps Opus
// without metadata, at the same relative path, so the catalog works unchanged against it. Reruns encode only
// new or changed files and remove copies the catalog no longer plays. Nothing here writes to the library.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { listAudioFiles } from './audio.ts';
import { forEachConcurrent } from './concurrency.ts';

const run = promisify(execFile);

export type EncodeFile = (source: string, target: string) => Promise<void>;

interface ExportOptions {
  audioDir: string;
  exportDir: string;
  relPaths: readonly string[];
  encode: EncodeFile;
  concurrency: number;
  log: (line: string) => void;
}

export interface ExportReport {
  encoded: number;
  unchanged: number;
  removed: number;
  failed: number;
}

// Clips are cut at 128 kbps MP3, so a 128 kbps source loses little, at about half the original size.
export function ffmpegEncoder(ffmpegPath: string): EncodeFile {
  return async (source, target) => {
    const args = ['-v', 'error', '-y', '-i', source, '-map', '0:a:0', '-map_metadata', '-1'];
    await run(ffmpegPath, [...args, '-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg', target]);
  };
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return !path.startsWith('..') && !isAbsolute(path);
}

// The export removes files, so it must never share a folder with the library.
function assertSeparate(audioDir: string, exportDir: string): void {
  const library = resolve(audioDir);
  const target = resolve(exportDir);
  if (isInside(library, target) || isInside(target, library)) {
    throw new Error('YSTO_EXPORT_DIR must be outside YSTO_AUDIO_DIR, and must not contain it.');
  }
}

function isCurrent(source: string, target: string): boolean {
  return existsSync(target) && statSync(target).mtimeMs >= statSync(source).mtimeMs;
}

// A copy is written under a temporary name and renamed when complete, so a stopped run leaves no half file.
async function encodeInto(encode: EncodeFile, source: string, target: string): Promise<void> {
  const partial = `${target}.part`;
  mkdirSync(dirname(target), { recursive: true });
  try {
    await encode(source, partial);
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
}

function removeStale(exportDir: string, wanted: ReadonlySet<string>): number {
  const stale = listAudioFiles(exportDir).filter((file) => !wanted.has(file.relPath));
  for (const file of stale) rmSync(join(exportDir, file.relPath));
  return stale.length;
}

export async function exportLibrary(options: ExportOptions): Promise<ExportReport> {
  const { audioDir, exportDir, relPaths, encode, concurrency, log } = options;
  assertSeparate(audioDir, exportDir);
  mkdirSync(exportDir, { recursive: true });
  const report: ExportReport = {
    encoded: 0,
    unchanged: 0,
    removed: removeStale(exportDir, new Set(relPaths)),
    failed: 0,
  };
  await forEachConcurrent(relPaths, concurrency, async (relPath) => {
    const source = join(audioDir, relPath);
    const target = join(exportDir, relPath);
    try {
      if (isCurrent(source, target)) {
        report.unchanged += 1;
        return;
      }
      await encodeInto(encode, source, target);
      report.encoded += 1;
    } catch {
      // A missing source or ffmpeg's error; their messages hold absolute paths, which output must not show.
      report.failed += 1;
      log(`failed: ${relPath}`);
    }
    const done = report.encoded + report.failed;
    if (done % 500 === 0) log(`${done} encoded`);
  });
  return report;
}
