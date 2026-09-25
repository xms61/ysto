// npm run catalog:build: brings the audio scan and the AniList cache up to date, assembles the catalog,
// writes catalog.sqlite, regenerates the schema doc, and prints a report for review.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { enrichFromAniList, loadAniList } from '../anilist.ts';
import { loadAnimeThemes } from '../animethemes.ts';
import { assembleCatalog } from '../assemble.ts';
import type { CatalogReport } from '../assemble.ts';
import { ffprobeDuration, scanAudio } from '../audio.ts';
import { logTo, parseFlagsOrExit, requireAudioDir, runOrExit } from '../cli.ts';
import { defaultConcurrency } from '../concurrency.ts';
import { listCoverFiles } from '../covers.ts';
import { isPresent } from '../fields.ts';
import { realHttp } from '../http.ts';
import { renderSchemaDoc } from '../schema-doc.ts';
import { writeCatalog } from '../store.ts';

const USAGE = 'usage: npm run catalog:build';
const SCHEMA_DOC = fileURLToPath(new URL('../../../docs/generated/catalog-schema.md', import.meta.url));
const UNMATCHED_SHOWN = 30;
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

function percent(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${((100 * part) / whole).toFixed(2)}%`;
}

function printReport(report: CatalogReport, log: (line: string) => void): void {
  log(
    `audio files: ${report.audioFiles}, matched ${report.matchedFiles} (${percent(report.matchedFiles, report.audioFiles)}), unreadable ${report.unreadableFiles}`,
  );
  if (report.unmatchedFiles.length > 0) {
    log(`unmatched files (${report.unmatchedFiles.length}):`);
    for (const file of report.unmatchedFiles.slice(0, UNMATCHED_SHOWN)) log(`  ${file}`);
  }
  log(
    `anime: ${report.animeTotal} from AnimeThemes, ${report.adultAnimeExcluded} adult left out, ${report.animeInCatalog} in the catalog, ${report.animeWithPopularity} with popularity, ${report.playableAnime} playable`,
  );
  log(
    `themes: ${report.themesInCatalog} in the catalog, ${report.playableThemes} playable, ${report.shortThemes} too short`,
  );
  log(`franchises: ${report.franchises}; the largest, for review:`);
  for (const group of report.largestFranchises) {
    const more = group.size > group.members.length ? ', …' : '';
    log(`  ${String(group.size).padStart(3)}  ${group.name}: ${group.members.join(' | ')}${more}`);
  }
}

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('build');
  const animeThemes = loadAnimeThemes(config.cacheDir);
  const audio = await scanAudio({
    audioDir: requireAudioDir(config),
    cacheDir: config.cacheDir,
    probe: ffprobeDuration(config.ffprobePath),
    concurrency: defaultConcurrency(),
    log: logTo('scan'),
  });
  const aniListIds = animeThemes.anime.map((anime) => anime.anilistId).filter(isPresent);
  await enrichFromAniList({
    ids: aniListIds,
    cacheDir: config.cacheDir,
    http: realHttp,
    now: () => new Date(),
    log: logTo('anilist'),
  });
  const aniList = loadAniList(config.cacheDir);
  const data = assembleCatalog({
    animeThemes: animeThemes.anime,
    aniList: aniList.media,
    audio,
    coverFiles: listCoverFiles(join(config.catalogDir, 'covers')),
  });
  writeCatalog(join(config.catalogDir, 'catalog.sqlite'), data, {
    built_at: new Date().toISOString(),
    animethemes_source: animeThemes.source,
    animethemes_completed_at: animeThemes.completedAt,
    anilist_fetched_at: aniList.fetchedAt ?? '',
    audio_files_total: String(data.report.audioFiles),
    audio_files_matched: String(data.report.matchedFiles),
    adult_anime_excluded: String(data.report.adultAnimeExcluded),
  });
  writeFileSync(SCHEMA_DOC, renderSchemaDoc());
  printReport(data.report, log);
  log('wrote catalog.sqlite; run `npm run catalog:check` next');
});
