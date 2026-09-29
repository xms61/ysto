import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest leaves CSS out by default; the theme contrast test reads the stylesheet's tokens.
    css: { include: [/styles\.css/] },
  },
});
