// npm run catalog:sync-animethemes: fetches AnimeThemes metadata into the cache, or imports a dump.
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { clearAnimeThemesCache, importDump, syncAnimeThemes } from '../animethemes.ts';
import { logTo, parseFlagsOrExit, runOrExit } from '../cli.ts';
import { realHttp } from '../http.ts';

const USAGE = 'usage: npm run catalog:sync-animethemes -- [--from-dump <file>] [--refresh]';
const flags = parseFlagsOrExit(
  USAGE,
  () =>
    parseArgs({
      options: { 'from-dump': { type: 'string' }, refresh: { type: 'boolean', default: false } },
      strict: true,
    }).values,
);

runOrExit(async () => {
  const { cacheDir } = loadCatalogConfig();
  const log = logTo('animethemes');
  const now = () => new Date();
  const dumpFile = flags['from-dump'];
  if (dumpFile !== undefined) {
    log(`imported ${importDump({ dumpFile, cacheDir, now })} anime from the dump`);
    return;
  }
  if (flags.refresh) clearAnimeThemesCache(cacheDir);
  log(`synced ${await syncAnimeThemes({ cacheDir, http: realHttp, now, log })} anime`);
});
