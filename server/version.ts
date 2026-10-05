// This build's version, from package.json, which the image ships beside the server. Clients compare it with
// their own and reload when they differ (docs/product-specs/lobby.md).
import { readFileSync } from 'node:fs';

const packageJson: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const SERVER_VERSION =
  typeof packageJson === 'object' && packageJson !== null && 'version' in packageJson
    ? String(packageJson.version)
    : 'unknown';
