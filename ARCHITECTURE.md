---
status: draft
last-verified: 2026-10-05
---

# Architecture

The shape of the system: what each part owns and which way dependencies point. Keep it to what changes rarely; details belong in the area docs next to the code.

## Bird's-eye view
You Skipped The OP?! is a browser quiz. Players join a lobby with a code, hear a sample of an anime opening or ending, and pick the anime from four options. One Node process serves the built React client and the HTTP API. Players create or join a lobby over HTTP, hold a WebSocket to it, and play games whose clips the server cuts per round and every browser plays through Web Audio. In production it runs as one container behind Caddy on a VPS ([DEPLOY.md](docs/DEPLOY.md)).

## Code map
- `server/`: the Node server. `main.ts` starts the process (config, catalog, listen, shutdown), `app.ts` builds the Express app, and `config.ts` is the only code that reads environment variables. `log.ts` writes JSON log lines, `rate-limit.ts` counts events per key, and `client-ip.ts` finds the player's IP behind the proxy. It never imports `src/`.
  - `server/catalog/`: `schema.ts` is the catalog's SQLite schema, shared by the build and the server. `load.ts` reads the catalog into memory at startup.
  - `server/game/`: lobbies and their registry, the question engine, which turns lobby settings into a game's songs, sample offsets and options, and the game engine (a pure state machine) with the shell that runs it ([GAME.md](server/game/GAME.md)). `server/scheduler.ts` gives the shell its clock and timers.
  - `server/http/`: the security headers and the lobby routes. `server/realtime/`: the lobby sockets and their protocol ([REALTIME.md](server/realtime/REALTIME.md)).
  - `server/clips/`: the clip service. It cuts clips with ffmpeg, keeps them under tokens, and serves them on `GET /api/clips/:token` ([CLIPS.md](server/clips/CLIPS.md)). `server/tokens.ts` defines the random tokens it and the sessions use.
- `src/`: the React client, which Vite bundles into `dist/`: the screens, the lobby socket and its store, the audio engine and the device settings ([FRONTEND.md](docs/FRONTEND.md)). It never imports `server/` or Node built-ins.
- `shared/`: code that runs on both sides. `settings.ts` holds the lobby settings, their limits, defaults and validator; `scoring.ts` the scoring modes, modifiers and presets; `protocol.ts` the messages, codes and validators; `names.ts` the player-name rules; and `validate.ts` the checks the validators share. It imports neither `server/` nor `src/`, and no Node built-ins.
- `tests/`: server and shared tests (`node:test`), laid out like the folders they test.
- `e2e/`: browser tests (Playwright) against the production build, served by `e2e/fixture-server.ts` on the catalog and tones that `e2e/fixture-data.ts` generates. CI's image check runs the image on the same data.
- `Dockerfile`, `.dockerignore` and `deploy/`: the image, and the VPS's compose file and Caddy config ([hosting and deploy](docs/design-docs/hosting-and-deploy.md), [DEPLOY.md](docs/DEPLOY.md)).
- `scripts/`: the repo checks (`check-docs.mjs`, `check-tracked-files.mjs`) and their tests, and `check-plate-contrast.mjs`, which checks the page's text over each theme's backdrop plate ([DESIGN.md](docs/DESIGN.md)).
  - `scripts/catalog/`: the offline catalog build, from AnimeThemes, AniList and the audio library to `catalog.sqlite` ([CATALOG.md](scripts/catalog/CATALOG.md)). It may import `server/config.ts`, `server/catalog/`, the seeded generator in `server/game/random.ts`, and `pool.ts`'s genre threshold.
  - `scripts/clips/bench.ts`: times clip cuts from the real library with the server's cutter. The image ships it, so it also runs on the VPS.
  - `scripts/load/`: the load test (`npm run load`): bots that play whole games over the API and sockets against a running server, and the verdict against the targets in [RELIABILITY.md](docs/RELIABILITY.md#performance).
- `docs/`: the knowledge base ([KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md)).

## Layers
`server/` and `src/` may import `shared/`. `shared/` imports neither of them, nor any Node built-in, and `src/` never imports `server/`. Only `server/catalog/` and `scripts/catalog/` open SQLite (`node:sqlite`). `eslint.config.js` enforces all of this with `no-restricted-imports`, so `npm run lint` fails on a wrong import.

## Invariants
- Only `server/config.ts` reads environment variables. It validates each one at startup, and each one is listed in `.env.example`. ESLint's `no-restricted-properties` rejects `process.env` anywhere else in `server/`, `shared/`, `src/` and the TypeScript scripts.
- Node 24 runs the server's TypeScript by stripping the types, with no build step. So relative imports name the real file with its extension, type-only imports use `import type`, and code uses only erasable syntax (no enums, namespaces or parameter properties). `tsc` enforces all three (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`).
- Game rules live in the pure engine (`server/game/engine.ts`): it never reads a clock, socket or file, so tests play whole games on a fake clock. The shell (`games.ts`) is the only place that runs its effects.
- Everything random in a game goes through the `Random` interface in `server/game/random.ts`: the operating system's secure generator in live games, a seeded one in tests.
- A `Question` holds the answer, so it never goes to a client as it is ([anti-cheat](docs/design-docs/anti-cheat.md)).
- ffmpeg runs only through `server/clips/ffmpeg.ts` (and the catalog scripts), with an argument array and never a shell.
- Nothing in git holds media, data or secrets, or reveals the owner's machine. `scripts/check-tracked-files.mjs` and gitleaks enforce this ([guardrails](.github/RELEASE_PROCESS.md)).

## Cross-cutting concerns
Each has an owner doc; link to it instead of restating it: errors and logging in [RELIABILITY.md](docs/RELIABILITY.md), secrets and input validation in [SECURITY.md](docs/SECURITY.md), test seams in [TESTING.md](docs/TESTING.md), generated schemas in [docs/generated/](docs/generated/).

## Area docs
Each area of code has a doc next to it, made from the [area doc template](docs/AREA_DOC_TEMPLATE.md) and listed in the map in [AGENTS.md](AGENTS.md).
