# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.10.0] - 2026-10-05

### Changed
- The cards never move from the deal to the reveal, on a phone or a desktop: the space above them keeps the height of the world's countdown and timer, and the verdict takes the timer's place.
- From 64rem a side column sits beside the cards for the whole round: the scores and who has answered, then at the reveal the answer, the scoreboard, the reactions and the report, so the reveal needs no scroll. The cards' height follows the window, so a laptop shows both rows.
- Who picked each card shows on the card's edge in larger name chips, and the scoreboard shows the card each player picked.

## [1.9.0] - 2026-10-05

### Changed
- Large screens: past 1920 x 1080 the whole page scales with the window, to twice the size on a 4K screen, instead of a small panel in the middle. Phones and screens up to 1080p are unchanged.

## [1.8.0] - 2026-10-05

### Added
- Reactions: in the lobby, at the reveal and on the results, six reactions (hype, laugh, shock, facepalm, heart, clap) drawn as the game's own icons. Each rises from its sender's name on screen, or from the corner with the name. Never while a round takes answers; one a second per player.

## [1.7.0] - 2026-10-05

### Added
- The lobby's tally: games played, and each player's wins and points across them. The player list shows wins, and from the second game the results say who leads. A player who leaves takes their line with them.

## [1.6.0] - 2026-10-05

### Added
- Clip reports: at the reveal and in the results' song list, "Report this clip" with four fixed reasons. The server keeps each report (theme, clip start, reason, time; nothing about the player) in `reports.sqlite` in `YSTO_STATE_DIR`, once per player and round. `npm run reports` lists them, most reported first.
- The image's first writable volume, `ysto_state` at `/data/state`. Copy the new `deploy/compose.yml` to the VPS before updating (DEPLOY.md).
