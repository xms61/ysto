// npm run catalog:export: writes the re-encoded copy of the library that the VPS serves (docs/DEPLOY.md).
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { logTo, parseFlagsOrExit, requireAudioDir, runOrExit } from '../cli.ts';
import { defaultConcurrency } from '../concurrency.ts';
import { exportLibrary, ffmpegEncoder } from '../export.ts';
import { readCatalogFacts } from '../store.ts';

const USAGE = 'usage: npm run catalog:export';
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('export');
  const { playablePrimaryFiles } = readCatalogFacts(join(config.catalogDir, 'catalog.sqlite'));
  const report = await exportLibrary({
    audioDir: requireAudioDir(config),
    exportDir: config.exportDir,
    relPaths: playablePrimaryFiles,
    encode: ffmpegEncoder(config.ffmpegPath),
    concurrency: defaultConcurrency(),
    log,
  });
  log(`${report.encoded} encoded, ${report.unchanged} unchanged, ${report.removed} removed, ${report.failed} failed`);
  if (report.failed > 0) throw new Error(`${report.failed} files failed to encode; rerun to retry them`);
});
