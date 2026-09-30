import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the client runs on Vite's port and the server on 3000. The proxy keeps the Host header, so
// the server's socket origin check sees the page's own origin.
const SERVER = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': SERVER,
      '/covers': SERVER,
      '/ws': { target: SERVER, ws: true },
    },
  },
});
