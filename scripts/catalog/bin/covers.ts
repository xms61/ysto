// npm run catalog:covers: downloads the cover of every anime in the catalog that has none yet.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { isAdultMedia, loadAniList } from '../anilist.ts';
import { loadAnimeThemes } from '../animethemes.ts';
import { logTo, parseFlagsOrExit, runOrExit } from '../cli.ts';
import { downloadCovers } from '../covers.ts';
import type { CoverSource } from '../covers.ts';
import { isPresent } from '../fields.ts';
import { realHttp } from '../http.ts';

const USAGE = 'usage: npm run catalog:covers';
// A few downloads in flight keep the run short without leaning on AniList's CDN.
const DOWNLOADS_IN_FLIGHT = 4;
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('covers');
  const { media } = loadAniList(config.cacheDir);
  const ids = new Set(
    loadAnimeThemes(config.cacheDir)
      .anime.map((anime) => anime.anilistId)
      .filter(isPresent),
  );
  const covers = [...ids]
    .sort((a, b) => a - b)
    .flatMap((anilistId): CoverSource[] => {
      const entry = media.get(anilistId);
      return entry && !isAdultMedia(entry) && entry.coverUrl ? [{ anilistId, url: entry.coverUrl }] : [];
    });
  const result = await downloadCovers({
    covers,
    coversDir: join(config.catalogDir, 'covers'),
    http: realHttp,
    concurrency: DOWNLOADS_IN_FLIGHT,
    log,
  });
  log(`downloaded ${result.downloaded}, already present ${result.skipped}`);
});
