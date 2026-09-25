# You Skipped The OP?!

A multiplayer anime music quiz in the browser. Players join a lobby with a code and a name, hear a random sample of an anime opening or ending, and pick the right anime from four options.

Status: early development. The server and client scaffold is in place, and the game itself is being built milestone by milestone ([v1 plan](docs/exec-plans/active/2026-09-25-ysto-v1.md)).

## Setup
```bash
git config core.hooksPath .githooks   # blocks commits with media, data, secrets or local paths
npm ci
cp .env.example .env                  # optional: every variable has a default
npm run dev                           # server on :3000, client on http://localhost:5173
```

Requires Node 24 (`.nvmrc`). For production, `npm run build && npm start` serves the app on port 3000.

## Building the catalog
The game plays clips from a local library of AnimeThemes audio files, which the repo never contains. To build its catalog, install ffmpeg and set `YSTO_AUDIO_DIR` in `.env` to the library's folder. Then run:
```bash
npm run catalog:sync-animethemes   # AnimeThemes metadata (or: -- --from-dump <file>)
npm run catalog:build              # durations, AniList data, catalog.sqlite and a report
npm run catalog:check              # the gate: matching, popularity, adult filter, loudness
```
Every step caches its work and resumes after an interruption. Details: [scripts/catalog/CATALOG.md](scripts/catalog/CATALOG.md).

## Commands
See the Commands table in [AGENTS.md](AGENTS.md).

## Documentation
[AGENTS.md](AGENTS.md) maps the docs: the [architecture](ARCHITECTURE.md), the [design docs](docs/design-docs/index.md), the [product specs](docs/product-specs/index.md) and the [release process](.github/RELEASE_PROCESS.md).

## Credits
Song and anime metadata come from [AnimeThemes](https://animethemes.moe) and [AniList](https://anilist.co). The repo contains no audio or artwork.

## License
Apache License 2.0. See [LICENSE](LICENSE). The license covers this repository's code and docs, not the music or artwork a running game plays or shows.
