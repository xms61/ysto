import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: `npm run build` first. The fixture server generates its catalog and
// tones with ffmpeg, and is ready once /readyz answers 200.
const PORT = 4173;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node e2e/fixture-server.ts',
    env: { PORT: String(PORT), LOG_LEVEL: 'warn' },
    url: `http://localhost:${PORT}/readyz`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
