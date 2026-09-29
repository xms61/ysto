---
status: draft
last-verified: 2026-09-29
---

# Reliability

How the app behaves when something fails or slows down. The general rules are in [CODE_STYLE.md](CODE_STYLE.md#errors-and-boundaries); this doc holds the specifics.

## Failure modes
| Failure | What players see | Recovery |
| :-- | :-- | :-- |
| Bad configuration at startup | The server doesn't start | `server/config.ts` exits with code 1 and names the bad variable |
| ffmpeg fails, times out or cuts a clip short | Nothing; the round uses another theme | Up to 3 themes per round, and each failure is logged once. After 3, the round is dropped and the game plays on |
| Nobody is connected when a round's barrier runs out | The game ends | Clips are cut only for games someone is playing |
| A player's clip doesn't load in time | They can still answer; the reveal marks them "no audio" | No penalty; the barrier waits at most 8 s |
| A player's connection drops | Their seat and score stay for 60 s | The client reconnects with its session token. The heartbeat notices a silent connection within 30 s |
| The host leaves | Another player becomes host | The player connected longest takes over |
| The server restarts | Running games end with a notice | The shutdown hook sends `server:closing` first; lobbies live only in memory |
| The catalog is missing or unreadable | No lobby can open (`not-ready`), and `/readyz` answers 503 | The process stays up and logs `catalog.unavailable`; fix the mount and restart |
| The audio folder is missing, or ffmpeg doesn't run | Lobbies open, but no game starts (`not-ready`); `/readyz` answers 503 | Logged at startup as `audio.unavailable` or `ffmpeg.unavailable`; fix and restart |

## Timeouts and retries
- ffmpeg: 10 s per clip, and up to 3 themes per round.
- Ready barrier: 8 s. The round then starts for everyone, 1 s later (3 s for a game's first round).
- Answer grace: 300 ms after `endsAt`. The reveal shows for 7 s, and a clip token lives 10 s past it (at most 10 minutes if its game ends early).
- Reconnect grace: 60 s. Lobby expiry: 15 minutes with no connected player, 4 hours in any case. The registry sweeps every 5 s, so both end up to 5 s late.
- Sockets: `hello` within 10 s of connecting, and a heartbeat ping every 15 s. A socket that misses a ping is closed, which starts its seat's grace.
- Ingest scripts: one AnimeThemes request a second, and one AniList request every 2.1 s (AniList allowed 30 a minute on 2026-09-25). A 429 waits for `Retry-After`. Server errors and network failures retry up to 5 attempts, backing off 2, 4, 8, 16 s (capped at 60 s). Every step resumes from its cache ([catalog](design-docs/catalog.md)).

## Performance
- A 30 s clip takes under 500 ms to cut at the 95th percentile. M3 measured 306 ms on the development machine with `npm run clips:bench`, and M8 repeats it on the VPS.
- The next clip is cut during the current round, so the gap between rounds is the reveal (about 7 s).
- Players hear the clip start within about the same moment, using clock offsets from `time:ping`.
- Load target: 25 concurrent lobbies of 8 players on the VPS, with clip p95 under 1 s and event-loop lag under 50 ms (M9 load script).
- The client bundle is about 70 KB gzipped today. It gets a budget when the game screens land (M6).

## Logging
- The server logs JSON lines (`time`, `level`, `event` and fields) to stdout at `LOG_LEVEL`, and Docker rotates them (3 files of 10 MB). Events: `server.listening`, `server.closing`, `catalog.unavailable`, `audio.unavailable`, `ffmpeg.unavailable`, `http.error`, and with the lobby code `lobby.created`, `lobby.closed`, `game.started`, `game.finished`, `clip.failed` and `round.dropped`. A bad configuration is printed as plain text, since the logger needs the configuration.
- It logs one line per lobby lifecycle event (created, game started, closed) and per error, with context. It never logs per-message traffic.
- It never logs session tokens, clip tokens, player names, request bodies or query strings.
