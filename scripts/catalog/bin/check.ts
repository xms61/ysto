// npm run catalog:check: the gate. Reads catalog.sqlite, cross-checks the adult flags against the
// AniList cache, measures the loudness of a seeded sample of playable files, and exits non-zero when a
// rule fails.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import type { CatalogConfig } from '../../../server/config.ts';
import { isAdultMedia, loadAniList } from '../anilist.ts';
import { ffmpegLoudness } from '../audio.ts';
import { evaluateGate, seededSample } from '../check.ts';
import { logTo, parseFlagsOrExit, requireAudioDir, runOrExit } from '../cli.ts';
import { defaultConcurrency, forEachConcurrent } from '../concurrency.ts';
import { readCatalogFacts } from '../store.ts';

const USAGE = 'usage: npm run catalog:check -- [--loudness-sample <count>]  (0 skips the loudness check)';
const DEFAULT_SAMPLE = 200;
const SAMPLE_SEED = 20260925;
const flags = parseFlagsOrExit(USAGE, () => {
  const { values } = parseArgs({ options: { 'loudness-sample': { type: 'string' } }, strict: true });
  const sample = values['loudness-sample'] === undefined ? DEFAULT_SAMPLE : Number(values['loudness-sample']);
  if (!Number.isInteger(sample) || sample < 0) throw new Error('--loudness-sample must be a whole number, 0 or more');
  return { sample };
});

// A file ffmpeg can't measure counts as out of range, so it can't hide a problem.
async function measureSample(config: CatalogConfig, files: string[], log: (line: string) => void): Promise<number[]> {
  const audioDir = requireAudioDir(config);
  const measure = ffmpegLoudness(config.ffmpegPath);
  const results: number[] = [];
  await forEachConcurrent(files, defaultConcurrency(), async (file) => {
    results.push(await measure(join(audioDir, file)).catch(() => Number.NaN));
    if (results.length % 50 === 0) log(`measured ${results.length}/${files.length}`);
  });
  return results;
}

function describeLoudness(values: number[]): string {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const unmeasured = values.length - sorted.length;
  const [min, median, max] = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
  if (min === undefined || median === undefined || max === undefined) return `none of ${values.length} files measured`;
  return `min ${min.toFixed(1)}, median ${median.toFixed(1)}, max ${max.toFixed(1)} LUFS over ${sorted.length} files (${unmeasured} unmeasured)`;
}

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('check');
  const facts = readCatalogFacts(join(config.catalogDir, 'catalog.sqlite'));
  const { media } = loadAniList(config.cacheDir);
  const sample = seededSample(facts.playablePrimaryFiles, flags.sample, SAMPLE_SEED);
  const loudnessLufs = sample.length > 0 ? await measureSample(config, sample, log) : [];
  if (loudnessLufs.length > 0) log(`loudness: ${describeLoudness(loudnessLufs)}`);
  const result = evaluateGate({
    audioFiles: Number(facts.meta.audio_files_total ?? 0),
    matchedFiles: Number(facts.meta.audio_files_matched ?? 0),
    animeInCatalog: facts.animeInCatalog,
    animeWithPopularity: facts.animeWithPopularity,
    playableThemes: facts.playableThemes,
    playableAnimeWithoutTitle: facts.playableAnimeWithoutTitle,
    adultAnimeInCatalog: facts.anilistIds.filter((id) => isAdultMedia(media.get(id))).length,
    genreThemeCounts: facts.genreThemeCounts,
    loudnessLufs,
  });
  log(
    `${facts.playableThemes} playable themes; genres: ${Object.entries(facts.genreThemeCounts)
      .map(([genre, n]) => `${genre} ${n}`)
      .join(', ')}`,
  );
  for (const warning of result.warnings) log(`warning: ${warning}`);
  for (const failure of result.failures) log(`FAIL: ${failure}`);
  if (result.failures.length > 0) process.exit(1);
  log('catalog passes the gate');
});
