---
status: verified
last-verified: 2026-09-29
---

# Lobby API and sockets

Entry: `server/realtime/hub.ts`. `Realtime` serves the lobby sockets at `/ws` on the HTTP server. The lobby routes are in `server/http/api.ts`, and both work through the `LobbyRegistry` ([GAME.md](../game/GAME.md)). The protocol's types, validators and codes are in `shared/protocol.ts`.
- `../http/api.ts`: `POST /api/lobbies` and `POST /api/lobbies/:code/players`, each returning a session token.
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
| `answer { roundId, option }` | player | locks in option 0–3 |
| `round:skip` | host | ends the round without points |

During a game the server sends `round:prepare`, `round:start`, `round:answered`, `round:reveal` and `game:results` ([game flow](../../docs/product-specs/game-flow.md)). It sends `lobby:state` after every lobby change and whenever a game starts, prepares a round or ends, `error { code }` for a refused message, and `server:closing` before a shutdown. Close codes: 1000 left, 1001 server closing, 1008 invalid messages, 1009 frame too large, 4001 kicked, 4002 lobby closed, 4003 unknown session, 4004 replaced by a newer socket.

## Rules
- The session token travels only in the first message or the clip route's `Authorization` header, never in a URL, and never in a log.
- Upgrades need an Origin with the request's own host, or one listed in `YSTO_ALLOWED_ORIGINS`. Other paths get 404, and other origins 403.
- Limits (`API_LIMITS`, `REALTIME_LIMITS`, `OPEN_LOBBIES_PER_IP`), all per IP unless noted:
  - HTTP: 5 creations and 30 joins a minute, 10 unknown codes a minute, 3 open lobbies, and a 4 KiB body limit
  - sockets: 30 per IP; per socket, 20 messages a second, 4 KiB frames, and `hello` within 10 s
- Invalid or excess messages each get an error. The fifth closes the socket with 1008. Host-rights errors don't count.
- A newer socket for the same seat replaces the older one, as when a tab reloads.
- Each socket keeps its last 5 ping round trips. The heartbeat, `hello` and every `round:prepare` send a ping, and an answer carries the median, from which the engine takes off at most 150 ms.
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
