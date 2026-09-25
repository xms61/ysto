---
status: draft
last-verified: 2026-09-25
---

# Architecture

The shape of the system: what each part owns and which way dependencies point. Keep it to what changes rarely; details belong in the area docs next to the code.

## Bird's-eye view
You Skipped The OP?! is a browser quiz. Players join a lobby with a code, hear a sample of an anime opening or ending, and pick the anime from four options. One Node process serves the built React client and the HTTP API. Today the server answers the health check and serves the client. The game protocol, the clip service and the catalog arrive with milestones M1–M5 of the [v1 plan](docs/exec-plans/active/2026-09-25-ysto-v1.md).

## Code map
- `server/`: the Node server. `main.ts` starts the process (config, listen, shutdown), `app.ts` builds the Express app, and `config.ts` is the only code that reads environment variables. It never imports `src/`.
- `src/`: the React client, which Vite bundles into `dist/`. It never imports `server/` or Node built-ins.
- `shared/`: code that runs on both sides, such as the protocol, settings and scoring. It stays empty until M2, but the layer rules already cover it: it imports neither `server/` nor `src/`, and no Node built-ins.
- `tests/`: server and shared tests (`node:test`), laid out like the folders they test.
- `e2e/`: browser smoke tests (Playwright) against the production build.
- `scripts/`: the repo checks (`check-docs.mjs`, `check-tracked-files.mjs`) and their tests.
- `docs/`: the knowledge base ([KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md)).

## Layers
`server/` and `src/` may import `shared/`. `shared/` imports neither of them, nor any Node built-in, and `src/` never imports `server/`. `eslint.config.js` enforces this with `no-restricted-imports`, so `npm run lint` fails on a wrong import.

## Invariants
- Only `server/config.ts` reads environment variables. It validates each one at startup, and each one is listed in `.env.example`. ESLint's `no-restricted-properties` rejects `process.env` anywhere else in `server/`, `shared/` and `src/`.
- Node 24 runs the server's TypeScript by stripping the types, with no build step. So relative imports name the real file with its extension, type-only imports use `import type`, and code uses only erasable syntax (no enums, namespaces or parameter properties). `tsc` enforces all three (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`).
- Nothing in git holds media, data or secrets, or reveals the owner's machine. `scripts/check-tracked-files.mjs` and gitleaks enforce this ([guardrails](.github/RELEASE_PROCESS.md)).

## Cross-cutting concerns
Each has an owner doc; link to it instead of restating it: errors and logging in [RELIABILITY.md](docs/RELIABILITY.md), secrets and input validation in [SECURITY.md](docs/SECURITY.md), test seams in [TESTING.md](docs/TESTING.md), generated schemas in [docs/generated/](docs/generated/).

## Area docs
Each area of code has a doc next to it, made from the [area doc template](docs/AREA_DOC_TEMPLATE.md) and listed in the map in [AGENTS.md](AGENTS.md).
