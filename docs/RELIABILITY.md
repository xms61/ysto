---
status: draft
last-verified: 2026-09-25
---

# Reliability

How the app behaves when something fails or slows down. The general rules are in [CODE_STYLE.md](CODE_STYLE.md#errors-and-boundaries); this doc holds the specifics.

## Failure modes
| Failure | What players see | Recovery |
| :-- | :-- | :-- |
| Bad configuration at startup | The server doesn't start | `server/config.ts` exits with code 1 and names the bad variable |
| ffmpeg fails or times out on a clip | Nothing; the round uses another theme | Up to 3 themes per round, and the error is logged once |
| A player's clip doesn't load in time | They can still answer; the reveal marks them "no audio" | No penalty; the barrier waits at most 8 s |
| A player's connection drops | Their seat and score stay for 60 s | The client reconnects with its session token |
| The host leaves | Another player becomes host | The player connected longest takes over |
| The server restarts | Running games end with a notice | The shutdown hook sends `server:closing` first; lobbies live only in memory |
| The catalog or audio folder is missing | `/readyz` fails, and the container is marked unhealthy | Fix the mount; `/healthz` still reports that the process is up |

## Timeouts and retries
- ffmpeg: 10 s per clip, and up to 3 themes per round.
- Ready barrier: 8 s. The round then starts for everyone.
- Answer grace: 300 ms after `endsAt`.
- Reconnect grace: 60 s. Lobby expiry: 15 minutes with no connected player, 4 hours in any case.
- Ingest scripts: they honor `Retry-After` on 429, pace their requests and resume from their cache ([catalog](design-docs/catalog.md)).

## Performance
- A 30 s clip takes under 500 ms to cut at the 95th percentile (measured in M3).
- The next clip is cut during the current round, so the gap between rounds is the reveal (about 7 s).
- Players hear the clip start within about the same moment, using clock offsets from `time:ping`.
- Load target: 25 concurrent lobbies of 8 players on the VPS, with clip p95 under 1 s and event-loop lag under 50 ms (M9 load script).
- The client bundle is about 70 KB gzipped today. It gets a budget when the game screens land (M6).

## Logging
- The server logs to stdout, which Docker rotates (3 files of 10 MB). Today it logs its startup line and configuration errors. JSON lines with `LOG_LEVEL` arrive with the lobby code in M4.
- It logs one line per lobby lifecycle event (created, game started, closed) and per error, with context. It never logs per-message traffic.
- It never logs session tokens, clip tokens, player names, request bodies or query strings.
