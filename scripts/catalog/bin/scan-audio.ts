// npm run catalog:scan-audio: reads the duration of every file in the audio library (cached).
import { parseArgs } from 'node:util';
import { loadCatalogConfig } from '../../../server/config.ts';
import { ffprobeDuration, scanAudio } from '../audio.ts';
import { logTo, parseFlagsOrExit, requireAudioDir, runOrExit } from '../cli.ts';
import { defaultConcurrency } from '../concurrency.ts';

const USAGE = 'usage: npm run catalog:scan-audio';
parseFlagsOrExit(USAGE, () => parseArgs({ options: {}, strict: true }));

runOrExit(async () => {
  const config = loadCatalogConfig();
  const log = logTo('scan');
  const files = await scanAudio({
    audioDir: requireAudioDir(config),
    cacheDir: config.cacheDir,
    probe: ffprobeDuration(config.ffprobePath),
    concurrency: defaultConcurrency(),
    log,
  });
  log(`${files.length} files, ${files.filter((file) => file.durationMs === null).length} unreadable`);
});
