// Reads and writes the JSON caches. A write goes to a temporary file that is then renamed into place,
// so an interrupted run never leaves a half-written cache behind.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJsonFile(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJsonFile(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value)}\n`);
  renameSync(temporary, file);
}
