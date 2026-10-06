---
status: draft
last-verified: 2026-10-05
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
| A player's connection drops | Their seat and score stay for 60 s, and the screen says "Reconnecting" | The client reconnects with its session token after 0.5, 1, 2 and 4 s, then every 5 s, and at once when the tab is back in view or the device back online. The heartbeat notices a silent connection within 30 s |
| The browser can't play the clip (no Web Audio, or no tap yet after a reload) | A banner says so, with a button that turns the sound on | They can still answer. A clip that failed to load marks them "no audio" in the reveal |
| The host leaves | Another player becomes host | The player connected longest takes over |
| The server restarts | Running games end with a notice | The shutdown hook sends `server:closing` first; lobbies live only in memory |
| The catalog is missing or unreadable | No lobby can open (`not-ready`), and `/readyz` answers 503 | The process stays up and logs `catalog.unavailable`; fix the mount and restart |
| The audio folder is missing, or ffmpeg doesn't run | Lobbies open, but no game starts (`not-ready`); `/readyz` answers 503 | Logged at startup as `audio.unavailable` or `ffmpeg.unavailable`; fix and restart |

## Timeouts and retries
- ffmpeg: 10 s per clip, and up to 3 themes per round.
- Ready barrier: 8 s. The round then starts for everyone, 1 s later (3 s for a game's first round).
- Answer grace: 300 ms after `endsAt`. The reveal shows for 7 s, and a clip token lives 10 s past it (at most 10 minutes if its game ends early).
- Reconnect grace: 60 s. Lobby expiry: 15 s with no connected player, so an empty lobby frees its place at once, and 4 hours in any case. The registry sweeps every second, so both end up to 1 s late.
- Sockets: `hello` within 10 s of connecting, and a heartbeat ping every 15 s. A socket that misses a ping is closed, which starts its seat's grace.
- Ingest scripts: one AnimeThemes request a second, and one AniList request every 2.1 s (AniList allowed 30 a minute on 2026-09-25). A 429 waits for `Retry-After`. Server errors and network failures retry up to 5 attempts, backing off 2, 4, 8, 16 s (capped at 60 s). Every step resumes from its cache ([catalog](design-docs/catalog.md)).

## Performance
- A 30 s clip takes under 500 ms to cut at the 95th percentile. M3 measured 306 ms on the development machine with `npm run clips:bench`, and M8 repeats it on the VPS.
- The next clip is cut during the current round, so the gap between rounds is the reveal (about 7 s).
- Players hear the clip start within about the same moment, using clock offsets from `time:ping`.
- Load target: 25 concurrent lobbies of 8 players, with clip p95 under 1 s and event-loop lag under 50 ms, checked by `npm run load` ([TESTING.md](TESTING.md)). On 2026-10-05 it ran three times on the development machine against the fixture server, each run 200 bots playing a 5-round game with one bot in ten letting a round run out: every game finished with no refusal, clips at p95 90 to 116 ms, and ping round trips at p95 3 to 9 ms (13 ms at most). Its first runs found rounds that never closed (a timer that fired a millisecond early), now fixed ([GAME.md](../server/game/GAME.md#gotchas)).
- The client is about 100 KB gzipped (90 KB of script, 12 KB of styles), plus the theme's display font, 10 to 24 KB. Its budget is 125 KB gzipped, fonts aside; `npm run build` prints the sizes.

## Logging
- The server logs JSON lines (`time`, `level`, `event` and fields) to stdout at `LOG_LEVEL`, and Docker rotates them (3 files of 10 MB). Events: `server.listening`, `server.closing`, `catalog.unavailable`, `audio.unavailable`, `ffmpeg.unavailable`, `http.error`, and with the lobby code `lobby.created`, `lobby.closed`, `game.started`, `game.finished`, `clip.failed` and `round.dropped`. A bad configuration is printed as plain text, since the logger needs the configuration.
- It logs one line per lobby lifecycle event (created, game started, closed) and per error, with context. It never logs per-message traffic.
- It never logs session tokens, clip tokens, player names, request bodies or query strings.
