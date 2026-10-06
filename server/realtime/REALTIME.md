---
status: verified
last-verified: 2026-10-06
---

# Lobby API and sockets

Entry: `server/realtime/hub.ts`. `Realtime` serves the lobby sockets at `/ws` on the HTTP server. The lobby routes are in `server/http/api.ts`, and both work through the `LobbyRegistry` ([GAME.md](../game/GAME.md)). The protocol's types, validators and codes are in `shared/protocol.ts`.
- `../http/api.ts`: `POST /api/lobbies` and `POST /api/lobbies/:code/players`, each returning a session token; `GET /api/daily` (whether the daily challenge is on, and today's number) and `POST /api/daily` (a locked one-player lobby for today's daily, counted as a creation; `daily-off` without the secret).
- `../http/headers.ts`: the security headers every response carries.
- `../client-ip.ts`: the player's IP behind `YSTO_TRUST_PROXY` proxies, for HTTP and upgrades alike.
- `../rate-limit.ts`: sliding-window counts per key.
- `../log.ts`: JSON log lines at `LOG_LEVEL`.

## Protocol
| Client → server | Who | Effect |
| :-- | :-- | :-- |
| `hello { sessionToken }` | anyone, first | binds the socket to its seat, or closes it with 4003 |
| `time:ping { clientTime }` | player | `time:pong { clientTime, serverTime }` |
| `lobby:leave` | player | releases the seat now; the socket closes with 1000 |
| `lobby:lock { locked }` | host | locks or unlocks joining |
| `player:kick { playerId }` | host | removes the player; their socket closes with 4001 |
| `settings:update { settings }` | host | new settings, checked against the catalog's bounds; refused while a game runs |
| `game:start` | host | starts a game, or the next one from the results |
| `round:ready { roundId, loaded }` | player | the round's clip is fetched and decoded, or failed to (`loaded: false`) |
| `clip:report { number, reason }` | player | reports the clip of round `number` (1–50) of the current or last game, for a reason in `REPORT_REASONS`; dropped when that round isn't revealed yet or the player already reported it |
| `player:icon { icon }` | player | switches the player's animal to one of `PLAYER_ICONS`; `icon-taken` when another player in the lobby has it |
| `reaction { kind }` | player | one of `REACTION_KINDS`, sent on to everyone in the lobby as `reaction { playerId, kind }`; passed at any time, also during a round, and dropped past 8 a second per player (no strike) |
| `answer { roundId, option }` | player | locks in option 0–3; with answer changes on, a later one for another option switches to it |
| `player:team { playerId, team }` | player, host | moves a player to team 0–3: a player moves themself, the host anyone; `unknown-team` past the settings' count, `game-running` during a game |
| `teams:shuffle` | host | deals the players out to the teams evenly at random; refused during a game |
| `answer:typed { roundId, animeId }` | player | with typing, answers a round with a playable anime (a suggestion's); dropped in a round with options, as `answer` is in a typing round |
| `titles:search { query }` | player | with typing, asks for suggestions for up to 80 characters; answered to that player alone as `titles:found { query, matches }`, up to 8 anime with their titles and year; dropped past 5 a second per player (no strike) |
| `round:hint { roundId }` | player | with hints on, asks for the round's hint, once, from halfway through the answer window to its end; dropped otherwise, and for a player whose answer is locked in |
| `round:skip` | host | ends the round without points |
| `game:end` | host | ends the game at once with its results; a round still running doesn't count (offered in an endless game) |

`round:start` carries `ask` (`anime`, `song` or `artist`), what the round's options name; with typing, an anime round's `options` are empty. The reveal carries the answer's `animeId`, and each typed pick its `typed` anime; a player who reconnects gets their typed answer back as `round:typed { match }`. With Teams, the players in `lobby:state` carry their `team`, and the game's view, the reveal (`teams`, with the round's `points`) and `game:results` carry the teams' totals. In an Elimination game, the players in `lobby:state`, the reveal's `standings` and the results carry each player's `lives` (0 once out); a classic game leaves the field out. During a game the server sends `round:prepare` (its `rounds` null in an endless game, which has no last round), `round:start`, `round:answered`, `round:reveal` and `game:results` ([game flow](../../docs/product-specs/game-flow.md)). With answer changes on it also sends `round:switched { playerId }` to the other players when someone switches, `round:overtime { startsAt, endsAt }` once everyone connected has answered, and to a player who reconnects, their own pick as `round:pick { option }`. With hints on it sends the player who asks, and only them, `round:hint { format, season, year }`, again when they reconnect. It sends `lobby:state` (with the server's `version`, from `package.json` through `server/version.ts`, and the lobby's `tally` of finished games) after every lobby change and whenever a game starts, prepares a round or ends (its `game` keeps the final results until the next game, for players who reconnect), `error { code }` for a refused message, and `server:closing` before a shutdown. Close codes: 1000 left, 1001 server closing, 1008 invalid messages, 1009 frame too large, 4001 kicked, 4002 lobby closed, 4003 unknown session, 4004 replaced by a newer socket.

## Rules
- The session token travels only in the first message or the clip route's `Authorization` header, never in a URL, and never in a log.
- Upgrades need an Origin with the request's own host, or one listed in `YSTO_ALLOWED_ORIGINS`. Other paths get 404, and other origins 403.
- Limits (`API_LIMITS`, `REALTIME_LIMITS`, `OPEN_LOBBIES_PER_IP`), all per IP unless noted:
  - HTTP: 5 creations and 30 joins a minute, 10 unknown codes a minute, 3 open lobbies, and a 4 KiB body limit
  - sockets: 30 per IP; per socket, 20 messages a second, 4 KiB frames, and `hello` within 10 s
- Invalid or excess messages each get an error. The fifth closes the socket with 1008. Host-rights errors don't count.
- A newer socket for the same seat replaces the older one, as when a tab reloads.
- The heartbeat pings every socket; one that misses a pong by the next beat is closed. Round trips are not measured: an answer's time is its arrival.
- Every refusal from the API has a JSON body `{ error }` with a code from `ErrorCode`. The client words the message.
- Without a catalog, `/readyz` answers 503, the lobby routes answer `not-ready`, and no socket is served.

## Gotchas
- Express's own 404 page sets its own CSP, so `createApp` ends with a JSON 404 that keeps the security headers.
- The registry's sweep runs every 5 s, so a seat's grace and a lobby's expiry end up to 5 s late.
- The heartbeat pings every 15 s and drops a socket that missed a ping. That starts its seat's 60 s grace.
- `server.kill('SIGTERM')` on Windows ends the process without running its handlers. Test shutdown through `Realtime.close`.

## Tests
- `tests/realtime/hub.test.ts` drives several `ws` clients against an in-process server (`tests/server/harness.ts`). It covers join, leave, reconnect, replacement, host handover, kick, settings, expiry, shutdown, origins, the per-IP cap, frame size, invalid messages and the message rate.
- `tests/realtime/game.test.ts` plays whole games over the sockets, including the clip route, spectators, skips and the start refusals.
- `tests/http/api.test.ts` covers creating and joining, every refusal, code guessing, the open-lobby cap, not-ready and the headers.
