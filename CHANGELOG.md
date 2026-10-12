# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.31.0] - 2026-10-12

### Changed
- Caddy can serve the owner's other apps on the same VPS: it imports their site files from `/opt/caddy-sites/` (`CADDY_SITES_DIR`) and joins the external Docker network `edge` to reach them. The game stays on its own network. Before updating, create the network and the folder once, as [DEPLOY.md](docs/DEPLOY.md#deploy-files) says, or `docker compose up` stops.

## [1.30.1] - 2026-10-12

### Changed
- The docs' gardening pass before the 1.30 release: the browser tests' list and fixture catalog (24 anime, openings only) in TESTING.md and the release process, the four checks the `main` ruleset requires (`docker` isn't one yet), and the components and `realtime/messages.ts` missing from the client's file map.

## [1.30.0] - 2026-10-12

### Added
- Three dailies a day instead of one: Openings (ten openings), Endings (ten endings) and Both (ten of either). Each is the same for everyone, has its own streak on the device, and shares as "Daily #42 · Endings". `POST /api/daily` takes an optional `mode` (`openings`, `endings` or `both`, the default).

### Changed
- The daily before 1.30.0 is now Both: its seed is unchanged, so its songs stay the same, and a device's streak from before carries on as the Both streak.

## [1.29.1] - 2026-10-06

### Changed
- CI runs the browser tests as one job per browser, side by side, and keeps the Ubuntu packages of the browsers' system libraries in the Actions cache, since the mirror took up to 13 minutes to send them. The required `e2e` check passes when all three browsers do.

## [1.29.0] - 2026-10-06

### Changed
- The server keeps up to 2000 lobbies open by default (`YSTO_MAX_LOBBIES`, up to 100000), up from 100.
- A lobby closes 15 s after its last player left or lost the connection, unless someone comes back first, instead of after 15 minutes. The registry sweeps every second instead of every 5 s.
- One address can have 10 lobbies open at once instead of 3, for homes and events that share a connection.

### Fixed
- Players who last played before 1.5.0 now see what's new: a device with saved preferences but no version noted counts as coming from 1.0.0, instead of as a first visit that shows nothing.
