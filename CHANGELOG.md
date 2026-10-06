# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.29.0] - 2026-10-06

### Changed
- The server keeps up to 2000 lobbies open by default (`YSTO_MAX_LOBBIES`, up to 100000), up from 100.
- A lobby closes 15 s after its last player left or lost the connection, unless someone comes back first, instead of after 15 minutes. The registry sweeps every second instead of every 5 s.
- One address can have 10 lobbies open at once instead of 3, for homes and events that share a connection.

### Fixed
- Players who last played before 1.5.0 now see what's new: a device with saved preferences but no version noted counts as coming from 1.0.0, instead of as a first visit that shows nothing.

## [1.28.0] - 2026-10-06

### Changed
- The daily's result shares like Wordle's: a line of colored squares (green right, red missed, grey skipped) under the game and the day, then the score and the streak, with blank lines between, ready to paste into Discord.

## [1.27.1] - 2026-10-06

### Changed
- The docs catch up with 1.17 to 1.27 before the release: the code map, the client's file map and storage keys, the security notes on typed answers, title searches and the per-address limits, and the README's summary of what the game offers.

## [1.27.0] - 2026-10-06

### Added
- Party mode: with it on in the lobby settings, a TV or laptop joins by the link with "Use as the screen" and plays the sound for everyone, showing the round large with the join QR in its corner, while the phones only answer. A lobby takes up to two screens, which don't count as players; a party game needs one connected to start.

## [1.26.0] - 2026-10-06

### Added
- Today's challenge: the same ten songs for everyone each day (it changes at 00:00 UTC), played solo from the home screen, with this device's streak of days in a row, badges at 7, 30 and 100 days, and a result to copy and share as plain blocks that name no song. Replays of a day are practice. Needs `YSTO_DAILY_SECRET` on the server.
