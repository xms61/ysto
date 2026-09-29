# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - 2026-09-29

### Added
- Lobbies ([REALTIME.md](server/realtime/REALTIME.md), [GAME.md](server/game/GAME.md)):
  - `POST /api/lobbies` creates a lobby and `POST /api/lobbies/:code/players` joins one. Each returns a session token.
  - A WebSocket at `/ws` binds to a seat with `hello` and sends every player the lobby state after each change: players, host, lock, settings, pool size, and what the settings may choose from.
  - Players can leave. The host can kick, lock and change the settings. When the host leaves, or stays away past the 60 s grace, the player connected longest takes over.
  - A player who drops keeps the seat for 60 s. A lobby closes after 15 idle minutes, or after 4 hours.
- Limits per IP: lobby creations, joins, unknown codes, open lobbies and sockets. Per socket: message rate, frame size, and strikes for invalid messages.
- Security headers (CSP, nosniff, no referrer, a Permissions-Policy, noindex) on every response. Errors never show a stack trace.
- `shared/protocol.ts` with the messages, error and close codes, and one validator per message. Also `shared/names.ts` with the name rules, and a settings validator against the catalog's bounds.
- `/readyz`, JSON log lines at `LOG_LEVEL`, and a shutdown that tells players before closing their sockets.
- `LOG_LEVEL`, `YSTO_TRUST_PROXY`, `YSTO_ALLOWED_ORIGINS`, `YSTO_MAX_LOBBIES` and `YSTO_MAX_PLAYERS`.
- The clip route is now mounted with the lobby sessions.

### Changed
- The server starts without a catalog and reports itself not ready, instead of serving lobbies it can't fill.
- The custom popularity range starts at every rank when the catalog has fewer than 1,000 anime.
- Settings offer only genres with at least 50 playable themes, the threshold the catalog gate warns at.

## [0.4.0] - 2026-09-29

### Added
- The clip service (`server/clips/`, [CLIPS.md](server/clips/CLIPS.md)):
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

---

Older releases are in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).
