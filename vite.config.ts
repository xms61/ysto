import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The page knows its own version, to compare with the server's (src/version.ts).
const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')) as { version: string };
export const VERSION_DEFINE = { __YSTO_VERSION__: JSON.stringify(version) };

// In development the client runs on Vite's port and the server on 3000. The proxy keeps the Host header, so
// the server's socket origin check sees the page's own origin.
const SERVER = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: VERSION_DEFINE,
  server: {
    proxy: {
      '/api': SERVER,
      '/covers': SERVER,
      '/ws': { target: SERVER, ws: true },
    },
  },
});
