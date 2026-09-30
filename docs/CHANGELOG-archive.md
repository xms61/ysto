# Changelog archive

Releases moved out of `CHANGELOG.md` (which keeps about the latest 5). Newest first.

## [0.4.0] - 2026-09-29

### Added
- The clip service (`server/clips/`, [CLIPS.md](../server/clips/CLIPS.md)):
  - a cutter that re-encodes the chosen part of a song to a 128 kbps MP3 with short fades, no tags, and only from files inside `YSTO_AUDIO_DIR`
  - an ffmpeg runner with an argument array, a 10 s timeout and a concurrency limit
  - clip tokens that belong to one lobby and expire
  - `GET /api/clips/:token`, which needs the player's session token and answers every refusal with the same 404. Lobbies wire it up in M4.
  - `prepareClip`, which moves a round to another theme when its cut fails, up to three themes, and logs each failure once
- `replacementQuestion` in the question engine draws that other theme from an anime the game doesn't use yet.
- `npm run clips:bench` times clip cuts from the real library. A 30 s clip took about 0.3 s on the development machine.
- A browser decode test (`e2e/clip-decode.spec.ts`) checks that the cutter's MP3 decodes through Web Audio at its length. The browser tests now run in Firefox too.

### Changed
- Clips are MP3 rather than the planned AAC: faster to encode, no container tags, and decodable without proprietary codecs.
- The e2e tests have their own TypeScript project with DOM types (`tsconfig.e2e.json`), which `npm run typecheck` includes.
- The hosting doc puts the library export at about half the original size, as measured, instead of 40%.

## [0.3.0] - 2026-09-25

### Added
- The question engine (`server/game/`, [GAME.md](../server/game/GAME.md)), which turns lobby settings into a game:
  - songs drawn by franchise, then anime, then theme, with no anime twice in a game, and themes the lobby has played skipped while enough others remain
  - a random sample start that keeps clear of the first 3 s and the last 5 s, or 0 s with the intro setting
  - three distractors that never share the answer's song, resemble the answer in popularity, era, genre and format, and never form a franchise pattern that points at the answer
  - option titles in English, romaji and Japanese, with romaji for all four when one title is missing, and years added to titles that match
- `server/catalog/load.ts` loads `catalog.sqlite` into memory, and refuses a catalog of another schema version.
- `shared/settings.ts` holds the lobby settings, their limits and defaults. `shared/scoring.ts` holds the Speed, First correct and Flat modes, the streak, comeback and penalty modifiers, the Classic, Buzzer and Chill presets, and the final ranking.
- Property tests build 10,000 seeded questions per difficulty on a synthetic catalog shaped like the real one. A table of cases covers the scoring.

### Changed
- Hard now pairs the answer with one other anime of its franchise and adds a pair from one other franchise, instead of filling the options from the answer's franchise first. Easy and Normal take their four options from four franchises. Distractors stay within the lobby's filters while its anime can fill them.
- `catalog:check` samples files with the game's seeded generator.

## [0.2.1] - 2026-09-25

### Changed
- Covers come from AnimeThemes' own images, not AniList. The sync asks for `images`, and `catalog:covers` downloads the large cover (or else the small one), named after the AnimeThemes anime id. With a dump, which has no cover links, the step explains that and stops.
- The AniList query no longer asks for cover images: only the fields the game uses, in line with AniList's terms.
- The plan records the owner's decisions on AniList use and covers (Q16).

## [0.2.0] - 2026-09-25

### Added
- The catalog build (`scripts/catalog/`), one command per step:
  - `catalog:sync-animethemes`: AnimeThemes metadata from the API, or `--from-dump`
  - `catalog:scan-audio`: durations with ffprobe
  - `catalog:enrich-anilist`: titles, genres, popularity, the adult flag and relations, fetched in paced batches
  - `catalog:covers`: optional, and on hold until the cover source is decided
  - `catalog:build`: writes `catalog.sqlite` and prints a review report
  - `catalog:check`: the gate for matching, popularity, the adult filter and loudness
- Every step caches its work and resumes after an interruption. The assembly is a pure function, so the same inputs give the same catalog.
- The catalog schema in `server/catalog/schema.ts`, and the generated `docs/generated/catalog-schema.md`.
- `YSTO_AUDIO_DIR`, `YSTO_CATALOG_DIR`, `YSTO_CACHE_DIR` and `YSTO_FFMPEG_PATH`, read by `loadCatalogConfig` in `server/config.ts`.
- Tests for every step: a fake HTTP client instead of the network, and ffmpeg-generated tones instead of the library.
- The area doc `scripts/catalog/CATALOG.md`, and a README section on building the catalog.

### Changed
- ESLint allows `node:sqlite` only in `server/catalog/` and `scripts/catalog/`, and `process.env` only in `server/config.ts`, now also for the scripts.
- Coverage includes `scripts/catalog/`, and the CI `app` job installs ffmpeg for the audio tests.
- The catalog design doc describes the build as implemented, including the gate's thresholds. SECURITY.md records AniList's and AnimeThemes' terms.

## [0.1.4] - 2026-09-25

### Added
- `LICENSE`: Apache License 2.0, also set in `package.json`, with a License section in the README.
- A "Before a release" step in the release process: the doc-gardening pass.

### Changed
- Doc gardening runs before each release, not weekly.
- The release process and SECURITY.md say that new high or critical CodeQL alerts block merges to `main`.
- The v1 plan records M0 as done, with the owner's answers on license, merging and gardening.

## [0.1.3] - 2026-09-25

### Added
- Design docs: system design, anti-cheat and score integrity, catalog, audio clips and playback, hosting and deploy.
- Product specs: game flow, questions and options, scoring, lobby, settings.
- A documentation and credits section in the README.

### Changed
- SECURITY, RELIABILITY, PRODUCT_SENSE and DESIGN are now drafts, no longer stubs.
- The v1 plan links to the docs that own each part of the design, and keeps only the milestones, progress and decisions.
- The README no longer has the template's setup section.

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
