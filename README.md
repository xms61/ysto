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

## Commands
See the Commands table in [AGENTS.md](AGENTS.md).

## Documentation
[AGENTS.md](AGENTS.md) maps the docs: the [architecture](ARCHITECTURE.md), the [design docs](docs/design-docs/index.md), the [product specs](docs/product-specs/index.md) and the [release process](.github/RELEASE_PROCESS.md).

## Credits
Song and anime metadata come from [AnimeThemes](https://animethemes.moe) and [AniList](https://anilist.co). The repo contains no audio or artwork.
