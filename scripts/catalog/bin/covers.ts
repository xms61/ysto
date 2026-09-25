// npm run catalog:covers: downloads the AnimeThemes cover of every catalog anime that has none yet.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { isAdultMedia, loadAniList } from '../anilist.ts';
import { loadAnimeThemes } from '../animethemes.ts';
import { logTo, parseFlagsOrExit, runOrExit } from '../cli.ts';
import { downloadCovers } from '../covers.ts';
import type { CoverSource } from '../covers.ts';
import { realHttp } from '../http.ts';

const USAGE = 'usage: npm run catalog:covers';
// A few downloads in flight keep the run short without leaning on AnimeThemes' servers.
const DOWNLOADS_IN_FLIGHT = 4;
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('covers');
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
    coversDir: join(config.catalogDir, 'covers'),
    http: realHttp,
    concurrency: DOWNLOADS_IN_FLIGHT,
    log,
  });
  log(`downloaded ${result.downloaded}, already present ${result.skipped}`);
});
