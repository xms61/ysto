// npm run clips:bench: cuts clips from the real library with the game's own cutter, one at a time, and
// reports how long each took. The target (docs/RELIABILITY.md): a 30 s clip in under 500 ms at the 95th
// percentile, on the host that serves the game. Reads the catalog and the audio folder, writes nothing.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalog } from '../../server/catalog/load.ts';
import { clipCutter } from '../../server/clips/cut.ts';
import { loadCatalogConfig } from '../../server/config.ts';
import { LEAD_IN_MS, TAIL_MS } from '../../server/game/pool.ts';
import { seededRandom, shuffle } from '../../server/game/random.ts';
import { parseFlagsOrExit, requireAudioDir, runOrExit } from '../catalog/cli.ts';

const USAGE = 'usage: npm run clips:bench -- [--count <clips, default 100>] [--length <seconds, 10 to 30, default 30>]';
const SEED = 20260929;

const flags = parseFlagsOrExit(USAGE, () => {
  const { values } = parseArgs({ options: { count: { type: 'string' }, length: { type: 'string' } }, strict: true });
  const count = Number(values.count ?? 100);
  const lengthSec = Number(values.length ?? 30);
  if (!Number.isInteger(count) || count < 1) throw new Error('--count must be a whole number, 1 or more');
  if (!Number.isInteger(lengthSec) || lengthSec < 10 || lengthSec > 30) throw new Error('--length must be 10 to 30');
  return { count, lengthMs: lengthSec * 1000 };
});

function percentile(sorted: number[], share: number): number {
  return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? Number.NaN;
}

runOrExit(async () => {
  const config = loadCatalogConfig();
  const catalog = loadCatalog(join(config.catalogDir, 'catalog.sqlite'));
  const cut = clipCutter({ audioDir: requireAudioDir(config), ffmpegPath: config.ffmpegPath, concurrency: 1 });
  const random = seededRandom(SEED);
  const longEnough = catalog.themes.filter((theme) => theme.durationMs >= LEAD_IN_MS + flags.lengthMs + TAIL_MS);
  const timings: number[] = [];
  let failures = 0;
  for (const theme of shuffle(longEnough, random).slice(0, flags.count)) {
    const latest = theme.durationMs - flags.lengthMs - TAIL_MS;
    const startMs = LEAD_IN_MS + random.int(latest - LEAD_IN_MS + 1);
    const started = performance.now();
    try {
      await cut({ relPath: theme.relPath, startMs, lengthMs: flags.lengthMs });
      timings.push(performance.now() - started);
    } catch {
      failures++;
    }
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const ms = (value: number) => `${Math.round(value)} ms`;
  console.log(
    `${timings.length} clips of ${flags.lengthMs / 1000} s: median ${ms(percentile(sorted, 0.5))}, ` +
      `p95 ${ms(percentile(sorted, 0.95))}, max ${ms(percentile(sorted, 1))}, ${failures} failed`,
  );
  if (failures > 0) process.exit(1);
});
