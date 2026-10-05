# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.12.0] - 2026-10-05

### Added
- Saved setups: the host saves the lobby's settings under a name, up to eight on the device, and loads one in any lobby they host. Loading fits it to the lobby's catalog and says what changed.

## [1.11.0] - 2026-10-05

### Added
- Player animals: sixteen animals drawn for the game as stamps, the same in every theme. Each player gets a free one on joining and can pick another in the lobby; two players share one only once all are taken. At the reveal each pick is stamped on its card's corner with the picker's animal, and the animals mark players in the lists, scores and results.

### Changed
- The answer box in the round's side column has a smaller cover and title, so long titles break between words.

### Removed
- The name chips under the cards, and their per-world styles.

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
