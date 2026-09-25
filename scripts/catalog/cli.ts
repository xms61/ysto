// Shared plumbing for the catalog commands in bin/: strict flags, one error path, and the checks on
// the catalog config that every step needs.
import { existsSync } from 'node:fs';
import type { CatalogConfig } from '../../server/config.ts';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseFlagsOrExit<T>(usage: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    console.error(errorMessage(error));
    console.error(usage);
    process.exit(2);
  }
}

export function runOrExit(task: () => Promise<void>): void {
  task().catch((error: unknown) => {
    console.error(`error: ${errorMessage(error)}`);
    process.exit(1);
  });
}

// The message names the variable, not the path, so pasted output never shows the local folder.
export function requireAudioDir(config: CatalogConfig): string {
  if (config.audioDir === null) {
    throw new Error('Set YSTO_AUDIO_DIR in .env to the folder that holds the audio library.');
  }
  if (!existsSync(config.audioDir)) throw new Error('The folder in YSTO_AUDIO_DIR does not exist.');
  return config.audioDir;
}

export function logTo(step: string): (line: string) => void {
  return (line) => console.log(`[${step}] ${line}`);
}
