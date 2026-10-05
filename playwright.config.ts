import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: `npm run build` first. The fixture server generates its catalog and
// tones with ffmpeg, and is ready once /readyz answers 200.
const PORT = 4173;
const isCI = Boolean(process.env.CI);

// Each browser gets its own client address, which the fixture server trusts from one proxy hop, so the
// per-IP lobby limits count each browser's tests on their own.
const clientAddress = (host: number) => ({ extraHTTPHeaders: { 'x-forwarded-for': `10.0.0.${host}` } });

// The browsers play the test tones silently: the clips still decode and play, only the speakers stay quiet.
// WebKit has no switch for it.
const muted = {
  chromium: { launchOptions: { args: ['--mute-audio'] } },
  firefox: { launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } },
};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...clientAddress(1), ...muted.chromium } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], ...clientAddress(2), ...muted.firefox } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...clientAddress(3) } },
  ],
  webServer: {
    command: 'node e2e/fixture-server.ts',
    env: { PORT: String(PORT), LOG_LEVEL: 'warn', YSTO_TRUST_PROXY: '1' },
    url: `http://localhost:${PORT}/readyz`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
