---
status: verified
last-verified: 2026-09-25
---

# Catalog scripts

Entry: `scripts/catalog/bin/*.ts`, one command per ingest step. Why the catalog is built this way: the [catalog design doc](../../docs/design-docs/catalog.md).
- `animethemes.ts`: syncs AnimeThemes pages or imports a dump, and parses the fields the catalog uses.
- `anilist.ts`: batched GraphQL enrichment. `isAdultMedia` is the one adult rule.
- `audio.ts`: lists the library, reads durations with ffprobe (cached), and measures loudness with ffmpeg.
- `covers.ts`: downloads AnimeThemes covers as `<animeId>.<ext>`.
- `assemble.ts`: pure. Turns the caches into catalog rows and the build report.
- `store.ts`: writes `catalog.sqlite` from `server/catalog/schema.ts`, and reads the facts the gate checks.
- `check.ts`: the gate's rules. `schema-doc.ts`: renders `docs/generated/catalog-schema.md`.
- `http.ts`, `json-files.ts`, `fields.ts`, `concurrency.ts`, `cli.ts`: plumbing shared by the steps.

## Commands
They need `YSTO_AUDIO_DIR` in `.env`, and ffmpeg and ffprobe (on PATH, or `YSTO_FFMPEG_PATH`).

| Command | Does |
| :-- | :-- |
| `npm run catalog:sync-animethemes` | Fetches AnimeThemes pages. `-- --refresh` starts over; `-- --from-dump <file>` imports a dump instead |
| `npm run catalog:scan-audio` | Reads the durations of new or changed files |
| `npm run catalog:enrich-anilist` | Fetches AniList data for anime it hasn't seen |
| `npm run catalog:covers` | Downloads missing AnimeThemes covers (optional; needs a live sync, since a dump has no cover links) |
| `npm run catalog:build` | Scan, enrich, assemble, write `catalog.sqlite`, regenerate the schema doc, print the report |
| `npm run catalog:check` | The gate; `-- --loudness-sample 0` skips the loudness part |

## Caches
Under `YSTO_CACHE_DIR` (default `data/cache/`). Delete a folder to rebuild it:
- `animethemes/`: raw pages (`page-NNNN.json`) and `complete.json`, which the build requires
- `anilist/media.json`: parsed media, plus the ids AniList doesn't know
- `audio/probes.json`: durations by relative path, with each file's size and mtime

## Rules
- Nothing here writes to the folder in `YSTO_AUDIO_DIR`. The library is read-only.
- Only this folder and `server/catalog/` open SQLite. ESLint enforces this.
- Settings come from `loadCatalogConfig` in `server/config.ts`, never from `process.env` directly (ESLint enforces this too).
- Error messages name variables, not paths, so pasted output never shows a local folder.
- `assemble.ts` stays pure: no files, network, clock or randomness. Everything it needs comes in through its inputs.
- A schema change bumps `SCHEMA_VERSION`, then `npm run catalog:build` regenerates the schema doc. Commit that doc with the change.

## Gotchas
- A dump has no series or synonyms, so franchises then come from AniList relations alone.
- The franchise rules are `FRANCHISE_RELATIONS` and `BRIDGING_RELATIONS` in `assemble.ts`. After changing them, rebuild and read the report's 20 largest groups: too wide a rule merges franchises through crossovers, and too narrow a rule splits sequels apart.
- AniList's terms prohibit hoarding its data. Keep requests to the anime in the library and the fields the game uses, and never fetch covers or other extras from it ([SECURITY.md](../../docs/SECURITY.md#external-services)). Covers come from AnimeThemes, and only after a live sync, since a dump has no cover links.
- AniList allowed 30 requests a minute on 2026-09-25, and the enrich step paces for that. A 429 waits for `Retry-After`. Any other failure retries five times with growing backoff.
- The caches hold file paths relative to the library. `data/` is git-ignored, and the tracked-files check refuses it.

## Tests
`tests/catalog/*.test.ts`:
- A fake HTTP client replaces the network.
- `tests/catalog/fixtures.ts` builds the data in code.
- The audio tests generate sine tones with ffmpeg in a temporary folder.
