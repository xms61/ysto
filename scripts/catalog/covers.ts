// Cover art: one image per anime from AnimeThemes, kept in <catalogDir>/covers/ as <animeId>.webp. Each
// download is scaled down to at most COVER_MAX_WIDTH and re-encoded to WebP, and covers on disk in another
// format are converted the same way, once. Files that exist are never fetched again, so a rerun only fills the
// gaps. AniList's covers are not used, because its terms prohibit hoarding its data.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { forEachConcurrent } from './concurrency.ts';
import { getBytes } from './http.ts';
import type { HttpClient } from './http.ts';

const run = promisify(execFile);

export interface CoverSource {
  animeId: number;
  url: string;
}

export type OptimizeCover = (source: string, target: string) => Promise<void>;

interface DownloadOptions {
  covers: CoverSource[];
  coversDir: string;
  http: HttpClient;
  optimize: OptimizeCover;
  concurrency: number;
  log: (line: string) => void;
}

interface ConvertOptions {
  coversDir: string;
  optimize: OptimizeCover;
  concurrency: number;
  log: (line: string) => void;
}

// The reveal shows covers 96 CSS px wide. 600 px leaves room for a larger reveal on 3x screens and is above
// AnimeThemes' largest size (about 460 px), so most covers keep their full resolution. Smaller ones are
// never enlarged.
export const COVER_MAX_WIDTH = 600;
const WEBP_QUALITY = 82;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const LOG_EVERY = 200;

export function ffmpegCoverOptimizer(ffmpegPath: string): OptimizeCover {
  return async (source, target) => {
    const scale = `scale='min(${COVER_MAX_WIDTH},iw)':-1`;
    const args = ['-v', 'error', '-y', '-i', source, '-frames:v', '1', '-map_metadata', '-1', '-vf', scale];
    await run(ffmpegPath, [...args, '-c:v', 'libwebp', '-quality', String(WEBP_QUALITY), '-f', 'webp', target]);
  };
}

export function coverFileName(animeId: number): string {
  return `${animeId}.webp`;
}

// Maps anime ids to the cover files on disk. A WebP file wins over one left from before the conversion.
export function listCoverFiles(coversDir: string): Map<number, string> {
  if (!existsSync(coversDir)) return new Map();
  const files = new Map<number, string>();
  for (const name of readdirSync(coversDir).sort()) {
    const id = Number(name.slice(0, name.indexOf('.')));
    const extension = extname(name).toLowerCase();
    if (!Number.isInteger(id) || !IMAGE_EXTENSIONS.has(extension)) continue;
    if (!files.has(id) || extension === '.webp') files.set(id, name);
  }
  return files;
}

// The WebP file is written under a temporary name and renamed when complete, so a stopped run leaves no
// half-written cover.
async function writeWebp(optimize: OptimizeCover, source: string, coversDir: string, animeId: number) {
  const target = join(coversDir, coverFileName(animeId));
  try {
    await optimize(source, `${target}.tmp`);
    renameSync(`${target}.tmp`, target);
  } finally {
    rmSync(`${target}.tmp`, { force: true });
  }
}

export async function convertCovers(options: ConvertOptions): Promise<{ converted: number; failed: number }> {
  const { coversDir, optimize, concurrency, log } = options;
  const todo = [...listCoverFiles(coversDir)].filter(([, name]) => extname(name).toLowerCase() !== '.webp');
  const result = { converted: 0, failed: 0 };
  await forEachConcurrent(todo, concurrency, async ([animeId, name]) => {
    try {
      await writeWebp(optimize, join(coversDir, name), coversDir, animeId);
      rmSync(join(coversDir, name));
      result.converted++;
      if (result.converted % LOG_EVERY === 0) log(`converted ${result.converted}/${todo.length}`);
    } catch {
      // The original stays, so the catalog keeps a cover and the next run tries again.
      result.failed++;
      log(`failed to convert ${name}`);
    }
  });
  return result;
}

export async function downloadCovers(options: DownloadOptions): Promise<{ downloaded: number; skipped: number }> {
  const { coversDir, optimize, concurrency, log } = options;
  mkdirSync(coversDir, { recursive: true });
  const existing = listCoverFiles(coversDir);
  const todo = options.covers.filter((source) => !existing.has(source.animeId));
  let downloaded = 0;
  await forEachConcurrent(todo, concurrency, async (source) => {
    const original = join(coversDir, `${source.animeId}.download`);
    try {
      writeFileSync(original, await getBytes(options.http, source.url));
      await writeWebp(optimize, original, coversDir, source.animeId);
    } finally {
      rmSync(original, { force: true });
    }
    downloaded++;
    if (downloaded % LOG_EVERY === 0) log(`downloaded ${downloaded}/${todo.length}`);
  });
  return { downloaded, skipped: options.covers.length - todo.length };
}
