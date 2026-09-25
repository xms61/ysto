# Changelog archive

Releases moved out of `CHANGELOG.md` (which keeps about the latest 5). Newest first.

## [0.1.2] - 2026-09-25

### Added
- App scaffold:
  - an Express 5 server (`server/`) with `/healthz`, which serves the built client and falls back to it for client-side routes such as join links
  - a React 19 client built by Vite 8, with Tailwind CSS 4 (`src/`)
- Tooling:
  - TypeScript 6.0, with separate configs for the client and for Node
  - ESLint 10, with the layer rules and a single reader of env vars, plus Prettier
  - Node's test runner with coverage thresholds, Vitest with Testing Library, and a Playwright smoke test in Chromium and WebKit
- CI jobs `app` (`npm run test:ci` and the build) and `e2e` (the smoke test), and Dependabot for npm.

### Changed
- Prettier formats the doc and tracked-files scripts.

## [0.1.1] - 2026-09-25

### Added
- `scripts/check-tracked-files.mjs`, with tests, keeps the public repo clean. It blocks media, databases, metadata dumps, env files, keys and files over 1 MiB. It also blocks text that reveals this machine: home-folder paths and the local user or host name. A pre-commit hook in `.githooks/` runs it on staged files.
- gitleaks in CI, pinned by version and checksum, with an extra rule for home-folder paths (`.gitleaks.toml`).
- An allowlist `.dockerignore`, so new data folders stay out of images.
- Dependabot updates for the SHA-pinned actions.

### Changed
- CI runs on every pull request and every push to `main`, and its actions are pinned by commit SHA.
- `.gitignore` also covers audio and video files, metadata dumps and more key formats.

## [0.1.0] - 2026-09-25

### Added
- Repository setup: agent doc map (`AGENTS.md`), code style, testing and release docs, CI.
- Knowledge base: `ARCHITECTURE.md`, design docs, product specs, exec plans, topic docs, and `scripts/check-docs.mjs`, which CI runs to enforce links, frontmatter, indexes and plan sections.
