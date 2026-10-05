// The version this page was built from (vite.config.ts reads it from package.json), and the reload to the
// server's version when they differ (docs/product-specs/lobby.md).
import { readItem, writeItem } from './storage.ts';

declare const __YSTO_VERSION__: string;

export const CLIENT_VERSION = __YSTO_VERSION__;

// Released storage keys are permanent.
const RELOADED_KEY = 'ysto_reloaded_for';

// Reloads a page of another version than the server's. It tries once per server version, so a cache that
// still serves the old page can't reload it forever. The seat survives: the session is in sessionStorage.
export function reloadIfStale(serverVersion: string, storage: Storage | null, reload: () => void): void {
  if (serverVersion === CLIENT_VERSION || readItem(storage, RELOADED_KEY) === serverVersion) return;
  writeItem(storage, RELOADED_KEY, serverVersion);
  reload();
}
