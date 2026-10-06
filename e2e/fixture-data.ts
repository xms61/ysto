// The data the browser tests and the image check play on: a small catalog built in code, and tones made with
// ffmpeg as its audio library, so no test touches real data (docs/TESTING.md). Run directly, it writes them
// into the folder given as its argument: `node e2e/fixture-data.ts <folder>`.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assembleCatalog } from '../scripts/catalog/assemble.ts';
import { writeCatalog } from '../scripts/catalog/store.ts';
import { anime, media, probed, theme } from '../tests/catalog/fixtures.ts';

// Enough anime for a game of the fewest songs on Normal, which keeps the easiest half of the themes.
const ANIME_IDS = Array.from({ length: 24 }, (_, index) => index + 1);
const TONE_SECONDS = 40;

function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-v', 'error', ...args]);
}

export function writeFixture(root: string): { audioDir: string; catalogDir: string } {
  const audioDir = join(root, 'audio');
  const catalogDir = join(root, 'catalog');
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(join(catalogDir, 'covers'), { recursive: true });
  for (const id of ANIME_IDS) {
    const tone = `sine=frequency=${200 + id * 40}:duration=${TONE_SECONDS}`;
    ffmpeg(['-f', 'lavfi', '-i', tone, '-ac', '2', '-c:a', 'libopus', join(audioDir, `anime${id}-OP1.ogg`)]);
  }
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x3355aa:s=96x136', '-frames:v', '1', join(catalogDir, 'covers', '1.jpg')]);
  const catalog = assembleCatalog({
    animeThemes: ANIME_IDS.map((id) => anime(id, { year: 2010 + id, themes: [theme(id, `anime${id}-OP1`)] })),
    aniList: new Map(ANIME_IDS.map((id) => [1000 + id, media(1000 + id, { popularity: 30_000 - id * 1000 })])),
    audio: ANIME_IDS.map((id) => probed(`anime${id}-OP1.ogg`, TONE_SECONDS * 1000)),
    coverFiles: new Map([[1, '1.jpg']]),
  });
  writeCatalog(join(catalogDir, 'catalog.sqlite'), catalog, {});
  return { audioDir, catalogDir };
}

if (import.meta.main) {
  const folder = process.argv[2];
  if (!folder) throw new Error('usage: node e2e/fixture-data.ts <folder>');
  writeFixture(resolve(folder));
}
