// Cover art: one image per anime from AniList's CDN, downloaded once into <catalogDir>/covers/ and named
// after the AniList id. Files that exist are never fetched again, so a rerun only fills the gaps.
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { forEachConcurrent } from './concurrency.ts';
import { getBytes } from './http.ts';
import type { HttpClient } from './http.ts';

export interface CoverSource {
  anilistId: number;
  url: string;
}

interface DownloadOptions {
  covers: CoverSource[];
  coversDir: string;
  http: HttpClient;
  concurrency: number;
  log: (line: string) => void;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const LOG_EVERY = 200;

export function coverFileName(source: CoverSource): string {
  const extension = extname(new URL(source.url).pathname).toLowerCase();
  return `${source.anilistId}${IMAGE_EXTENSIONS.has(extension) ? extension : '.jpg'}`;
}

// Maps AniList ids to the cover files already on disk.
export function listCoverFiles(coversDir: string): Map<number, string> {
  if (!existsSync(coversDir)) return new Map();
  const files = new Map<number, string>();
  for (const name of readdirSync(coversDir).sort()) {
    const id = Number(name.slice(0, name.indexOf('.')));
    if (Number.isInteger(id) && IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) files.set(id, name);
  }
  return files;
}

export async function downloadCovers(options: DownloadOptions): Promise<{ downloaded: number; skipped: number }> {
  mkdirSync(options.coversDir, { recursive: true });
  const existing = listCoverFiles(options.coversDir);
  const todo = options.covers.filter((source) => !existing.has(source.anilistId));
  let downloaded = 0;
  await forEachConcurrent(todo, options.concurrency, async (source) => {
    const file = join(options.coversDir, coverFileName(source));
    writeFileSync(`${file}.tmp`, await getBytes(options.http, source.url));
    renameSync(`${file}.tmp`, file);
    downloaded++;
    if (downloaded % LOG_EVERY === 0) options.log(`downloaded ${downloaded}/${todo.length}`);
  });
  return { downloaded, skipped: options.covers.length - todo.length };
}
