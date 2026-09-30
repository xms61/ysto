// npm run catalog:covers: converts covers on disk to WebP, then downloads the AnimeThemes cover of every catalog
// anime that has none yet. `npm run catalog:build` afterwards puts the new file names into the catalog.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { isAdultMedia, loadAniList } from '../anilist.ts';
import { loadAnimeThemes } from '../animethemes.ts';
import { logTo, parseFlagsOrExit, runOrExit } from '../cli.ts';
import { defaultConcurrency } from '../concurrency.ts';
import { convertCovers, downloadCovers, ffmpegCoverOptimizer } from '../covers.ts';
import type { CoverSource } from '../covers.ts';
import { realHttp } from '../http.ts';

const USAGE = 'usage: npm run catalog:covers';
// A few downloads in flight keep the run short without leaning on AnimeThemes' servers.
const DOWNLOADS_IN_FLIGHT = 4;
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('covers');
  const coversDir = join(config.catalogDir, 'covers');
  const optimize = ffmpegCoverOptimizer(config.ffmpegPath);
  const conversion = await convertCovers({ coversDir, optimize, concurrency: defaultConcurrency(), log });
  if (conversion.converted + conversion.failed > 0) {
    log(`converted ${conversion.converted} covers to WebP, ${conversion.failed} failed`);
  }
  const { media } = loadAniList(config.cacheDir);
  const covers = loadAnimeThemes(config.cacheDir).anime.flatMap((anime): CoverSource[] => {
    const adult = anime.anilistId !== null && isAdultMedia(media.get(anime.anilistId));
    return anime.coverUrl !== null && !adult ? [{ animeId: anime.id, url: anime.coverUrl }] : [];
  });
  if (covers.length === 0) {
    log(
      'The AnimeThemes cache has no cover links (a dump has none). Run `npm run catalog:sync-animethemes -- --refresh` first.',
    );
    return;
  }
  const result = await downloadCovers({
    covers,
    coversDir,
    http: realHttp,
    optimize,
    concurrency: DOWNLOADS_IN_FLIGHT,
    log,
  });
  log(`downloaded ${result.downloaded}, already present ${result.skipped}`);
});
