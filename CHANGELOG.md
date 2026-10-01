# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.14.1] - 2026-10-01

### Changed
- CI installs ffmpeg from Ubuntu packages kept in the Actions cache, downloaded once per runner image, instead of fetching them from the mirror in every job, where they took up to 15 minutes.

## [0.14.0] - 2026-10-01

### Added
- Eight new themes: Konbini 2 a.m., Karaoke Box, Omikuji, Blossom Map, Tournament Arc, Splash Page, Night Arc and Side A. For now they print the shared card layout in their own colors and faces; each gets its own round, reveal and results in a later release.
- A new backdrop plate for every theme, from the prompts in docs/PLATE_PROMPTS.md.

### Changed
- Six themes take the names of the worlds they are becoming: Sakura is Hanami, Shonen is Fighter Select, Mecha is Model Kit, Magical Girl is Gachapon, Isekai is Quest Board and Retro VHS is Back Issue. Saved settings keep working, since the ids are unchanged.

## [0.13.0] - 2026-09-30

### Changed
- The listening panel is a sonar instead of an equalizer: over-ear headphones in a ring, gray while the clip loads and lit in the theme's accent when ready. While the clip plays, rings leave the headphones every 1.4s and sweep the whole round panel behind the cards, and "Listen." is read to screen readers only.
- The reveal prints the answer on a band: the cover sharp over a blurred wash of itself, the title large beside it and stepping down in size for long titles, then the theme's kind and number on an accent chip with the song, artists and season.
- The reveal's standings are a scoreboard: an arrow for each player who moved up or fell back this round, the round's points with a check or a cross, and the total in the display face.
- The winner on the results screen is printed on the theme's card back, with each theme's own ornament.

## [0.12.1] - 2026-09-30

### Changed
- The v1 plan and DEPLOY.md record that the covers are converted to WebP and the catalog is rebuilt from the live AnimeThemes API, ready for the first upload.

## [0.12.0] - 2026-09-30

### Changed
- Covers are stored as WebP, at most 600 px wide and never enlarged. `npm run catalog:covers` converts the covers already on disk once, then downloads new ones in the same format; `npm run catalog:build` afterwards records the new file names. A sample shrank to about 29 % of its size, most covers at full resolution.
- Browsers keep covers for a day, so a cover that comes back in a game isn't fetched again.

## [0.11.1] - 2026-09-30

### Fixed
- A crossover that AnimeThemes files under several series (Isekai Quartet, Kaginado) no longer merges those franchises into one, which Hard mode would have treated as a single franchise.

### Changed
- The catalog is built from a live AnimeThemes sync instead of the September dump: franchises now use AnimeThemes series, titles gain their synonyms, and reveals show cover art.

## [0.11.0] - 2026-09-30

### Added
- A Docker image: Node 24 on Alpine with ffmpeg, run as a non-root user with a health check, and without npm, corepack or yarn.
- `deploy/`: the VPS's compose file, with Caddy serving HTTPS on the domain in `YSTO_DOMAIN` and the game hardened behind it (read-only, no capabilities, no published port), a Caddyfile, and a `.env.example`.
- `npm run catalog:export`: re-encodes every file the catalog plays to 128 kbps Opus in `YSTO_EXPORT_DIR` for the VPS. Reruns encode only new or changed files and remove copies no longer played.
- The release workflow, started by hand from main: reruns CI, publishes the image for amd64 and arm64 to GHCR with an SBOM and provenance, tags the version and creates the GitHub release.
- A `docker` CI job: builds the image, runs it on the fixture catalog until it is ready, cuts clips in it, checks that it holds no audio or database file, and scans it with Trivy.
- `docs/DEPLOY.md`, the runbook for the Hetzner VPS, the library upload, releases and rollbacks.
- `robots.txt`, which disallows everything.

### Changed
- The browser tests' fixture catalog is written by `e2e/fixture-data.ts`, which the image check uses too.
- Dependabot also keeps the base image and Caddy digests current.
