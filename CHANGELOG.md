# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-09-25

### Added
- The question engine (`server/game/`, [GAME.md](server/game/GAME.md)), which turns lobby settings into a game:
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

---

Older releases are in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).
