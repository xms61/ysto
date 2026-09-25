---
status: draft
last-verified: 2026-09-25
---

# Security

The answer to a round is protected by the [anti-cheat design](design-docs/anti-cheat.md). This doc covers everything else: secrets, input, sessions, transport, player data and the public repo.

## Secrets
- The running server needs no secret. If one is ever added, it lives in `.env`, which git ignores, or in the host's environment or GitHub Actions secrets. It is never logged or sent to clients, and it gets a gitleaks rule.
- [.env.example](../.env.example) lists every variable, and `server/config.ts` is the only code that reads them (ESLint enforces this). Each value is validated at startup, and a bad one stops the server with a clear message.
- What must never be committed, and the checks that enforce it, are in the [release guardrails](../.github/RELEASE_PROCESS.md). That includes details of the owner's machine, because the repo is public. The VPS's SSH keys never go into the repo or into GitHub.

## Input
Every external input is validated once, at the boundary ([CODE_STYLE.md](CODE_STYLE.md#errors-and-boundaries)):
- There is one hand-written validator per message and request body, in `shared/protocol.ts`, from M4 on. Settings are checked against the catalog's bounds (year range, genre list).
- Player names are normalized and cleaned as the [lobby spec](product-specs/lobby.md) describes. React escapes all text, and the app never uses `dangerouslySetInnerHTML`.
- The client never sends a file path or catalog ID for audio ([audio clips](design-docs/audio-clips.md)).
- Limits: anyone who has the URL can create lobbies, so these limits carry the abuse protection.
  - WebSocket frames over 4 KiB are refused (`maxPayload`), and JSON bodies over 4 KiB get a 413.
  - Per IP: 5 lobby creations per minute and at most 3 open lobbies, 30 joins per minute, and 10 unknown codes per minute. Players in one home share an IP, so the connection cap per IP (30) stays above the lobby size.
  - Per socket: 20 messages per second. Repeated invalid messages close the socket with code 1008.
  - Global caps: `YSTO_MAX_LOBBIES`, `YSTO_MAX_GAMES`, `YSTO_MAX_PLAYERS` and the ffmpeg concurrency. Clips are cut only for running games with connected players.

## Sessions
- There are no accounts. Creating or joining a lobby returns a 256-bit random session token. The client keeps it in `sessionStorage` (one seat per tab) and sends it as the first WebSocket message, never in a URL.
- There are no cookies, so there is nothing for CSRF to exploit.
- After `hello`, the player's identity is bound to the socket. The server never trusts a player ID in a message body, and it checks host rights on every host action.
- A kicked player's token can't rejoin that lobby.

## Transport
- HTTPS and `wss://` go through Caddy with HSTS. `YSTO_TRUST_PROXY` holds the proxy's hop count, so rate limits see player IPs.
- Every response gets a CSP of `default-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. It also gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` and `X-Robots-Tag: noindex`. The server already turns `X-Powered-By` off.
- WebSocket upgrades must come from the page's own origin or from `YSTO_ALLOWED_ORIGINS`.

## External services
- **AnimeThemes and AniList:** only the offline ingest scripts call them ([catalog](design-docs/catalog.md)). They need no keys and receive only paced catalog queries with a User-Agent that names the repo. The About screen credits both, and M1 checks their API terms.
- **The running server calls no third-party service.** Covers and fonts are served from our own origin, so players' browsers talk only to it.

## User data
Nothing about players is stored on disk. Names and session tokens live in memory for as long as the lobby lasts. Logs never contain session tokens, clip tokens or player names, and IP addresses stay in memory for rate limiting only. There are no accounts, cookies or analytics.

## Copyright
The audio and the cover art are copyrighted. Lobby creation is open, so anyone who finds the URL can play clips. The site stays low-profile: short clips, no downloads, no public lobby list, noindex, and attribution. If strangers start using it, a passphrase for creating lobbies is a small change. The themes use only original art and type ([DESIGN.md](DESIGN.md)). None of this is legal advice.

## Dependencies
- Add a dependency only when the standard library or an existing dependency can't do the job ([CODE_STYLE.md](CODE_STYLE.md)). The server's runtime dependencies stay minimal, and client libraries are devDependencies bundled by Vite.
- Dependabot opens weekly PRs for npm and GitHub Actions. Actions are pinned by commit SHA, and third-party tools in CI are pinned by version and checksum (gitleaks).
- GitHub secret scanning, push protection, Dependabot alerts and CodeQL are on for the repo.
