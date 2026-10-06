---
status: draft
last-verified: 2026-10-06
---

# Testing

| Command | What | Where |
| :-- | :-- | :-- |
| `npm test` | Server, shared and catalog tests (`node:test`) | `tests/**/*.test.ts` |
| `npm run test:coverage` | The same tests with coverage thresholds over `server/`, `shared/` and `scripts/catalog/`: lines and functions ≥ 85 %, branches ≥ 75 %. `server/main.ts` and `scripts/catalog/bin/` only wire things together and are left out. | Node's built-in coverage; the flags are in `package.json` |
| `npm run test:web` | Client tests (Vitest, jsdom, Testing Library): the reducer, clock, socket, store and audio engine against fakes, whole flows through `App`, and the themes' contrast | `src/**/*.test.{ts,tsx}`, `vitest.config.ts` |
| `npm run test:e2e` | Browser tests against the production build, in Chromium, Firefox and WebKit: the smoke test, the clip decode test, a whole game with two players, on a phone the lobby's start bar on the viewport's foot and the cards keeping their place and size from answering to the reveal, and axe on every screen in every theme (Chromium only). Run `npm run build` first. | `e2e/`, `playwright.config.ts` |
| `npm run load` | The load test: 25 lobbies of 8 bots play whole games against a running server, fetching every clip, readying, answering (one round in ten they let run out) and pinging every 2 s. It passes when every game finishes with no refusal, clips at p95 under 1 s and ping round trips (the event loop's lag on one machine) at p95 under 50 ms. Run it against `node e2e/fixture-server.ts` (with `PORT` and `YSTO_TRUST_PROXY=1`, since each bot sends its own address), never against a server players use. A run takes about 2.5 minutes; Flags: `--url`, `--lobbies`, `--players`, `--rounds`. | `scripts/load/`, `tests/load/` |
| `npm run test:ci` | Lint, format check, typecheck, coverage and client tests: everything CI runs except the build, the smoke test and the repo checks | `.github/workflows/ci.yml` |
| `node --test scripts/*.test.mjs` | Tests of the doc and tracked-files checks | `scripts/` |

The browser tests need their browsers once per machine: `npx playwright install chromium firefox webkit`. Chromium and Firefox run muted (`playwright.config.ts`), so the test tones never reach the speakers; the clips still decode and play. WebKit has no switch for it. The catalog's audio tests, the clip tests and the browser tests need `ffmpeg` and `ffprobe` on PATH. CI installs them with `.github/actions/ffmpeg`, which keeps the Ubuntu packages in the Actions cache per runner image, since the mirror can take a quarter of an hour to send them. The e2e job keeps Playwright's browsers in the cache too, keyed to the Playwright version. The e2e folder has its own TypeScript project (`tsconfig.e2e.json`), because code inside `page.evaluate` runs in the browser and needs the DOM types that server code must not see.

## Isolation
- Tests never touch the network or the real data directory.
- Code that calls an API takes an `HttpClient`. Tests pass `fakeHttp` from `tests/catalog/fixtures.ts`, which answers from a list and records every request and sleep, so retries and pacing are checked without waiting.
- The audio and clip tests generate short sine tones with ffmpeg in a temporary folder, never touching the real library.
- Code that draws randomly takes a `Random` (`server/game/random.ts`). Tests pass `seededRandom(seed)`, so every run draws the same songs, offsets and options.
- Game tests build catalogs in code (`tests/game/fixtures.ts`): small ones with `animeEntry`, `themeEntry` and `catalogOf`, and `syntheticCatalog()`, a seeded catalog shaped like the real one for the property tests.
- Server tests call `createApp` directly and listen on port 0, so the system picks a free port and a running dev server never clashes with them. The HTTP and socket tests start the real app, games and realtime layer this way (`tests/server/harness.ts`), with a `ManualScheduler` as the clock of the registry and the games, and a stand-in clip cutter. They talk to it with `fetch` and `ws` clients, and move time with `scheduler.advance`.
- The client tests pass their fakes to the code under test: `socketFactory()` and `FakeSocket` for the lobby socket, `FakeAudioContext` for Web Audio, `FakeClipPlayer` for the store, and `lobbyState()` and friends for server messages, all in `src/testing/fakes.ts`. `App` takes the audio engine, the storage and the socket factory as props for this.
- The browser tests run against `e2e/fixture-server.ts`: `e2e/fixture-data.ts` builds a 12-anime catalog in code with the catalog build's own writer and makes 40 s tones with ffmpeg in a temporary folder, and the fixture server starts `server/main.ts` on them. CI's `docker` job runs the image on the same data (`node e2e/fixture-data.ts <folder>`). It never reads `.env`, so no browser test touches the real library. The game test plays five rounds, the fewest a game allows, in under a minute per browser.
- Each browser project sends its own `X-Forwarded-For` address and the fixture server trusts one proxy hop (`YSTO_TRUST_PROXY=1`), so the per-IP lobby limits count each browser's tests on their own.
- `src/themes.test.ts` reads each theme's colors from `styles.css` (Vitest processes that one stylesheet, `vitest.config.ts`) and checks WCAG AA for every text and graphic pair. `e2e/a11y.spec.ts` plays a game alone and runs axe on each screen, the theme picker included, in all fifteen themes, failing on any serious or critical issue. The contrast test covers the card stock too: text on cards, chosen cards, card backs and index marks.
- The game engine is tested without any shell: a simulator in `tests/game/engine.test.ts` feeds it events on a fake clock, serves its clip cuts at once and fires its timers in order.
- Every test builds its own fixtures with a small function (`clientDirWith(files)`), and temporary folders are deleted in `after`. No state carries over from one test to the next.
- Use in-memory or temp-dir databases, never the app's singleton for writes.
- Fixture data is generated by code, never committed as binary files. The tracked-files check refuses audio and databases anyway.

## Writing tests
- One test per behavior, named after the behavior: `rejects a live recording`, not `test 3`.
- Put rule corpora in a table and loop over it: `const CASES: [input: string, expected: boolean][] = [...]`.
- Use equality assertions (`assert.equal`, `deepEqual`), so a failure shows both values.
- Test behavior through public functions. Don't assert on private helpers, the size of constant lists, or `typeof x === 'function'`.
- Server tests are TypeScript that Node runs directly, so they import the real file with its extension (`../../server/app.ts`).
- A bug fix adds the test that would have caught it.
- Delete tests that only lock in data or implementation details.

## When a test fails
- Rerun the single file (see the one-file command in `AGENTS.md`) to see the full error.
- Fix the code, not the assertion, unless the assertion was wrong. Say which one it was in the PR.
