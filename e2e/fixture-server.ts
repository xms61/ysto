// The server the browser tests play against: the real server/main.ts with the built client, on the fixture
// catalog and tones (e2e/fixture-data.ts). Playwright starts it as its web server.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFixture } from './fixture-data.ts';

// One fixed folder, cleared on every start, so a run that was killed leaves nothing behind for long.
const root = join(tmpdir(), 'ysto-e2e');
rmSync(root, { recursive: true, force: true });
const { audioDir, catalogDir } = writeFixture(root);

// The server reads its configuration when it loads, so the fixture's folders are set first.
process.env.YSTO_CATALOG_DIR = catalogDir;
process.env.YSTO_AUDIO_DIR = audioDir;
await import('../server/main.ts');
