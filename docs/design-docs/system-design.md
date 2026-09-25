---
status: draft
last-verified: 2026-09-25
---

# System design

## Context
A group of friends plays together on one small VPS. The catalog holds about 14,500 themes and rarely changes. Lobbies last minutes, and there are no accounts. Every decision that affects the score has to stay out of the players' hands ([anti-cheat](anti-cheat.md)).

## Decision
**Stack.**
- Node 24 runs the server's TypeScript directly (type stripping, no build step), with Express 5 and `ws`.
- The client is React 19, Vite and Tailwind CSS 4.
- The catalog is SQLite through the built-in `node:sqlite`, so there is no native module to compile.
- ffmpeg cuts clips and ffprobe scans the library.

**One process** serves the built client, the HTTP API and the WebSocket protocol:
```
 Browser (React)                    Server (one Node process)                 Read-only mounts
 +----------------------+   /ws    +--------------------------------+
 | screens, themes      |<-------->| realtime: sessions, validation,|
 | realtime client      |          |   rate limits                  |
 | audio engine         |          | game: lobbies, round state     |
 |   (Web Audio, 15%)   |  HTTPS   |   machine, questions, scoring  |
 | prefs (localStorage) |<-------->| clips: ffmpeg cut, tokens -----+--> audio library (.ogg)
 +----------------------+ /api,    | catalog: in-memory index ------+--> catalog.sqlite, covers/
                          /covers  | http: static files, REST,      |
                                   |   security headers             |
                                   +--------------------------------+
 Offline: scripts/catalog/* read AnimeThemes and AniList (no keys) and ffprobe the library -> catalog.sqlite
```

**Runtime state** (lobbies, sessions, rounds, clip tokens) lives in memory. Nothing about players is written to disk. The [catalog](catalog.md) is built offline, mounted read-only and loaded into memory at startup, so song selection is plain filtering.

**The game engine** in `server/game/` is a pure state machine: `step(state, event, now, random) → { state, effects }`. The effects are "send to player", "broadcast", "set timer" and "prepare clip", and a thin shell runs them against real sockets and timers.

**No third-party calls at runtime.** Metadata and covers are fetched by the offline ingest scripts, and covers are served from our own origin.

**Planned code map**, with the layer rules already enforced by ESLint ([ARCHITECTURE.md](../../ARCHITECTURE.md)):
- `server/`: `http/` (headers, CORS, rate limits, routes), `realtime/` (sockets, sessions, dispatch), `game/` (lobby registry, state machine, question builder), `clips/` (ffmpeg runner, token registry, route), `catalog/` (loads SQLite), `config.ts`, `shutdown.ts`
- `shared/`: protocol types and validators, settings and their defaults, scoring and its presets
- `src/`: `screens/`, `components/`, `audio/`, `realtime/`, `themes/`, `prefs/`
- `scripts/catalog/`: the ingest and export steps

**Protocol.**
- Client → server: `hello { sessionToken }`, `round:ready`, `answer`, `time:ping`. Host only: `settings:update`, `game:start`, `game:again`, `round:skip`, `player:kick`, `lobby:lock`.
- Server → client: `lobby:state`, `round:prepare`, `round:start`, `round:answered` (who has answered, not what), `round:reveal`, `game:results`, `time:pong`, `error`, `server:closing`.

| HTTP route | Purpose |
| :-- | :-- |
| `POST /api/lobbies` | Create a lobby: `{ name }` → `{ code, playerId, sessionToken }` |
| `POST /api/lobbies/:code/players` | Join: `{ name }` → `{ playerId, sessionToken }` |
| `GET /api/clips/:token` | The round's clip; needs `Authorization: Bearer <sessionToken>` from a player in that lobby ([audio clips](audio-clips.md)) |
| `GET /covers/:file` | Cover art, referenced only in reveals |
| `GET /healthz`, `GET /readyz` | Liveness; readiness means the catalog is loaded, the audio folder is readable and ffmpeg is found |

**Planned configuration.** `server/config.ts` reads every variable, and `.env.example` lists each one as it lands. None is a secret, and once released none may be renamed.

| Variable | Default | Purpose |
| :-- | :-- | :-- |
| `PORT` | 3000 | HTTP and WebSocket port |
| `LOG_LEVEL` | info | |
| `YSTO_AUDIO_DIR` | required | Root folder of the audio library |
| `YSTO_CATALOG_DIR` | `./data/catalog` | `catalog.sqlite` and `covers/` |
| `YSTO_CACHE_DIR` | `./data/cache` | Raw API responses for the ingest scripts |
| `YSTO_TRUST_PROXY` | 0 | Reverse proxy hop count, so rate limits see player IPs |
| `YSTO_ALLOWED_ORIGINS` | none | Origins allowed besides the page's own |
| `YSTO_MAX_LOBBIES` | 100 | |
| `YSTO_MAX_GAMES` | 30 | Games running at once, sized to ffmpeg capacity |
| `YSTO_MAX_PLAYERS` | 12 | Per lobby |
| `YSTO_FFMPEG_PATH` | `ffmpeg` | `ffprobe` is expected next to it |
| `YSTO_FFMPEG_CONCURRENCY` | CPU count − 1 | Parallel clip jobs |

## Alternatives considered
- **Next.js:** rejected. No page needs server rendering, and WebSockets fit it poorly.
- **Socket.IO or Colyseus:** rejected. `ws` plus a small state machine covers the need without a framework.
- **PostgreSQL:** rejected. It's a server to run and back up, for data that is rebuilt from its sources.
- **Redis for lobbies:** rejected. It's only needed with more than one instance.
- **Checking answers on the client:** rejected ([anti-cheat](anti-cheat.md)).

## Consequences
- A restart ends running games. The shutdown hook tells clients first.
- One process serves dozens of lobbies. Serving more needs Redis and sticky sessions.
- Every rule (barrier, deadline, lock-in, scoring, host handover) can be tested with a fake clock and a seeded random source.
