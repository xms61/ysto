# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

## [0.10.1] - 2026-09-30

### Changed
- M6 is done: a whole game on a real iPhone played every clip, at the 15% default volume and with the silent switch on. The v1 plan and the audio clips doc record the check.

## [0.10.0] - 2026-09-30

### Added
- The right card lands with its stock's own hit at the reveal: a departure board flapping in the title (Tokyo Rain), a gold ring and a petal burst (Sakura), a red starburst and a shake (Shonen), lock brackets clamping on (Mecha), a foil ring and sparkles (Magical Girl), a flashing window and pixels (Isekai), a tracking glitch (Retro VHS). It lands harder on a streak of 3 and of 5.
- The results are announced from the bottom up, like a festival bill: the winner's name drops in last, its score counts up, and its theme's material bursts from it.
- The verdict lands like a stamp with a badge, and a streak chip shows from 2 right answers in a row.
- The face-down cards carry the game's "?!", slide in off the deck and idle with a passing light; locking in stamps the pick and gives a short buzz on phones.
- Each backdrop follows the game: more weather while the clip plays, and a flash at the reveal and the results (lightning, speed lines, hazard strips, a foil ring, static). Shonen's page turns speed lines while the clip plays, and Mecha's hangar blinks with beacons.
- "How to play" on the home screen, and the name's "?!" stamped on in the accent.
- A painted scene behind each theme's page, with no characters or text, kept faint enough that the page's text still passes AA contrast.

### Changed
- All four options turn face up together as the clip starts, in 180ms on a curve that shows the titles within about a frame, instead of appearing without a turn.
- The host's song pool and scoring rules fold under "Adjust the song pool and scoring rules"; the presets stay in view with a line on what the mode means.
- The lobby code is set in the theme's display face, and the lobby's start bar is solid.
- The results fill the screen, with Play again at their foot.
- The countdown's number is in the accent at full strength, and screen readers hear "Get ready" once rather than every second.
- A new screen (the lobby, a game, the results) moves the focus to its heading.

### Fixed
- The face-down cards before the clip never drew, in any theme.
- Players on the same score share a place at the reveal and in the results.
- Mecha's round heading no longer pushes "Skip round" onto a line of its own on a phone.
