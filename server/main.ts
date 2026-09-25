// Starts the server: loads the config, serves the app, and closes cleanly on SIGINT and SIGTERM.
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import type { Config } from './config.ts';

const CLIENT_DIR = fileURLToPath(new URL('../dist/', import.meta.url));

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (error) {
    console.error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const server = createApp({ clientDir: CLIENT_DIR }).listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close());
}
