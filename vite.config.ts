import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// In development the client runs on Vite's port and the server on YSTO_DEV_SERVER_PORT (from the environment or
// .env, default 3000). The proxy keeps the Host header, so the server's socket origin check sees the page's own
// origin.
export default defineConfig(({ mode }) => {
  const port = loadEnv(mode, process.cwd(), 'YSTO_DEV_').YSTO_DEV_SERVER_PORT ?? '3000';
  const server = `http://localhost:${port}`;
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': server,
        '/covers': server,
        '/ws': { target: server, ws: true },
      },
    },
  };
});
