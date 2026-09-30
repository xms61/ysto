---
status: draft
last-verified: 2026-09-30
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
- The client never sends a file path or catalog ID for audio ([audio clips](design-docs/audio-clips.md)). ffmpeg gets an argument array, never a shell, and only files inside `YSTO_AUDIO_DIR`.
- Limits: anyone who has the URL can create lobbies, so these limits carry the abuse protection.
  - WebSocket frames over 4 KiB are refused (`maxPayload`), and JSON bodies over 4 KiB get a 413.
  - Per IP: 5 lobby creations per minute and at most 3 open lobbies, 30 joins per minute, and 10 unknown codes per minute. Players in one home share an IP, so the connection cap per IP (30) stays above the lobby size.
  - Per socket: 20 messages per second, and `hello` within 10 s. Invalid or excess messages each get an error, and the fifth closes the socket with code 1008.
  - Global caps: `YSTO_MAX_LOBBIES`, `YSTO_MAX_GAMES`, `YSTO_MAX_PLAYERS` and the ffmpeg concurrency. Clips are cut only for running games with connected players.

## Sessions
- There are no accounts. Creating or joining a lobby returns a 256-bit random session token. The client keeps it in `sessionStorage` under `ysto_session` (one seat per tab) and sends it as the first WebSocket message, never in a URL. Clip requests send it in the `Authorization` header. `server/tokens.ts` defines the shape of session and clip tokens once.
- There are no cookies, so there is nothing for CSRF to exploit. Responses that carry a session token are never cached (`Cache-Control: no-store`).
- After `hello`, the player's identity is bound to the socket. The server never trusts a player ID in a message body, and it checks host rights on every host action.
- A kicked player's token can't rejoin that lobby.

## Transport
- HTTPS and `wss://` go through Caddy with HSTS, on a domain, never the bare IP. Caddy is the only service with a public port; the game's container publishes none and runs read-only, without capabilities, as a non-root user ([hosting and deploy](design-docs/hosting-and-deploy.md)). The compose file sets `YSTO_TRUST_PROXY=1` for Caddy's hop, so rate limits see player IPs.
- The VPS accepts SSH keys only, with root login off, and a cloud firewall and ufw allow only 22, 80 and 443 ([DEPLOY.md](DEPLOY.md)).
- Every response gets a CSP of `default-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. It also gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` and `X-Robots-Tag: noindex`. The server already turns `X-Powered-By` off.
- WebSocket upgrades must come from the page's own origin (the Origin's host is the request's Host) or from `YSTO_ALLOWED_ORIGINS`. An upgrade without an Origin is refused.
- Errors never show a stack trace: unexpected ones get a bare 500, and unknown paths a JSON 404, both with the headers above.

## External services
- **AnimeThemes and AniList:** only the offline ingest scripts call them ([catalog](design-docs/catalog.md)). They need no keys, and receive only paced catalog queries with a User-Agent that names the repo. They never see player data. The README and the About screen credit both. Their terms:
  - **AniList** (read 2026-09-25): non-commercial use is free (and free commercial use up to $150 of revenue a month). The API must not serve as a backup or data store, and *"hoarding or mass collection"* of its data is prohibited. So the build asks only for the anime in the library, only the fields the game needs (no covers), refreshes once a season, and never republishes the data. The owner reviewed this on 2026-09-25 and kept it. Covers come from AnimeThemes instead ([catalog](design-docs/catalog.md)).
  - **AnimeThemes** (Terms of Service last updated 2021-03-18, read 2026-09-30): the site may not be used for commercial or revenue-generating ventures, or to compete with it. The game is free, has no ads or payments, credits AnimeThemes, and doesn't offer its videos or catalog. It uses the metadata offline and doesn't compete with the site.
- **The running server calls no third-party service.** Covers and fonts are served from our own origin, so players' browsers talk only to it.

## User data
Nothing about players is stored on disk. Names and session tokens live in memory for as long as the lobby lasts. Logs never contain session tokens, clip tokens or player names, and IP addresses stay in memory for rate limiting only. There are no accounts, cookies or analytics.

## Copyright
The audio and the cover art are copyrighted. Lobby creation is open, so anyone who finds the URL can play clips. The site stays low-profile: short clips, no downloads, no public lobby list, noindex, and attribution. If strangers start using it, a passphrase for creating lobbies is a small change. The themes use only original art and type ([DESIGN.md](DESIGN.md)). None of this is legal advice.

## Dependencies
- Add a dependency only when the standard library or an existing dependency can't do the job ([CODE_STYLE.md](CODE_STYLE.md)). The server's runtime dependencies stay minimal, and client libraries are devDependencies bundled by Vite.
- Dependabot opens weekly PRs for npm, GitHub Actions and the Docker images. Actions are pinned by commit SHA, base images by digest, and third-party tools in CI by version and checksum (gitleaks, Trivy).
- CI's `docker` job fails on a fixable high or critical vulnerability in the image (Trivy). The image carries no package manager: npm, corepack and yarn are removed from the runtime stage.
- GitHub secret scanning, push protection, Dependabot alerts and CodeQL are on for the repo. A new CodeQL alert of high or critical severity blocks merging ([release process](../.github/RELEASE_PROCESS.md)).
