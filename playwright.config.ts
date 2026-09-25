import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: `npm run build` first.
const PORT = 4173;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node server/main.ts',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !isCI,
  },
});
