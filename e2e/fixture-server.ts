// The server the browser tests play against: the real server/main.ts with the built client, a small catalog
// built in code, and tones made with ffmpeg as its audio library, so no test touches real data
// (docs/TESTING.md). Playwright starts it as its web server.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assembleCatalog } from '../scripts/catalog/assemble.ts';
import { writeCatalog } from '../scripts/catalog/store.ts';
import { anime, media, probed, theme } from '../tests/catalog/fixtures.ts';

// Enough anime for a game of the fewest songs on Normal, which keeps the easiest half of the themes.
const ANIME_IDS = Array.from({ length: 12 }, (_, index) => index + 1);
const TONE_SECONDS = 40;

// One fixed folder, cleared on every start, so a run that was killed leaves nothing behind for long.
const root = join(tmpdir(), 'ysto-e2e');
const audioDir = join(root, 'audio');
const catalogDir = join(root, 'catalog');
rmSync(root, { recursive: true, force: true });
mkdirSync(audioDir, { recursive: true });
mkdirSync(join(catalogDir, 'covers'), { recursive: true });

function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-v', 'error', ...args]);
}

for (const id of ANIME_IDS) {
  const tone = `sine=frequency=${200 + id * 40}:duration=${TONE_SECONDS}`;
  ffmpeg(['-f', 'lavfi', '-i', tone, '-ac', '2', '-c:a', 'libopus', join(audioDir, `anime${id}-OP1.ogg`)]);
}
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x3355aa:s=96x136', '-frames:v', '1', join(catalogDir, 'covers', '1.jpg')]);

const catalog = assembleCatalog({
  animeThemes: ANIME_IDS.map((id) => anime(id, { year: 2010 + id, themes: [theme(id, `anime${id}-OP1`)] })),
  aniList: new Map(ANIME_IDS.map((id) => [1000 + id, media(1000 + id, { popularity: 20_000 - id * 1000 })])),
  audio: ANIME_IDS.map((id) => probed(`anime${id}-OP1.ogg`, TONE_SECONDS * 1000)),
  coverFiles: new Map([[1, '1.jpg']]),
});
writeCatalog(join(catalogDir, 'catalog.sqlite'), catalog, {});

// The server reads its configuration when it loads, so the fixture's folders are set first.
process.env.YSTO_CATALOG_DIR = catalogDir;
process.env.YSTO_AUDIO_DIR = audioDir;
await import('../server/main.ts');
