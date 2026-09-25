// npm run catalog:enrich-anilist: fetches AniList data for every anime in the AnimeThemes cache.
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { enrichFromAniList } from '../anilist.ts';
import { loadAnimeThemes } from '../animethemes.ts';
import { logTo, parseFlagsOrExit, runOrExit } from '../cli.ts';
import { isPresent } from '../fields.ts';
import { realHttp } from '../http.ts';

const USAGE = 'usage: npm run catalog:enrich-anilist';
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const { cacheDir } = loadCatalogConfig();
  const log = logTo('anilist');
  const ids = loadAnimeThemes(cacheDir)
    .anime.map((anime) => anime.anilistId)
    .filter(isPresent);
  const result = await enrichFromAniList({ ids, cacheDir, http: realHttp, now: () => new Date(), log });
  log(`fetched ${result.fetched}, not found ${result.missing}`);
});
