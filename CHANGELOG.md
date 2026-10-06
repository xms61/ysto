# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.18.0] - 2026-10-06

### Changed
- Tokyo Rain and Konbini 2 a.m. merge into Neon Rain, the default: Tokyo at night in the rain, in neon magenta and cyan. The round's heading is a neon sign, the time left a cyan LED, and the options holographic street ads under scanlines with LED tags; the right answer locks in as a solid magenta ad and the others drop to "No signal". A player who had Konbini 2 a.m. gets Neon Rain.

### Fixed
- Fighter Select's and Back Issue's answer tags in the reveal lost their own style to a broken rule; they are slanted and inked again.

### Removed
- The display faces only the retired worlds used, and Konbini's marker face.

## [1.17.0] - 2026-10-06

### Removed
- Six worlds: Hanami, Tournament Arc, Splash Page, Night Arc, Model Kit and Gachapon, with their timers (the dango skewer, the referee's pennants, the focus lines, the nipper and the coin dial), icons and backdrop plates. A player who had one picked gets Tokyo Rain. The picker shows the nine that stay three by three.

## [1.16.0] - 2026-10-06

### Added
- Endless games: with "Endless" on in the lobby settings, rounds keep coming until the host ends the game with "End the game", in any phase (a round still running doesn't count), or until the pool has no unplayed anime left. The heading shows the round without a total, and the results count the rounds played. Endless games stay out of the anime log. The server deals the questions five at a time as the game goes.

## [1.15.0] - 2026-10-06

### Changed
- Reactions are the platform's emoji (fire, tears of joy, screaming, facepalm, red heart, clapping hands) and the game's own "?!", bare glyphs without frames. They can be sent all through a round too, up to 8 a second per player, and each appears at a random spot round where it came from and drifts up in smooth curves as it fades, at most 40 on screen.
- The round on a wide screen fits the window exactly, with no scroll at 1080p, 2K or 4K: the cards fill the middle column's height at a fixed size, a long title shrinking to fit, their foot level with the scores column's. The scores sit at the top left with the reactions and "Report this clip" at the foot, in every phase; the answer column is wider and its cover grows into the room it has. The status and the clip's state sit above the cards with the timer.
- Picks are stamped down the right side of the picked card, wholly inside it and clear of its text, in one color per world with at least 3:1 on every card face; the "Your pick" tag no longer shows at the reveal.
- The right card's back shows its label and title only; the answer column says which song it was.
- Romaji and Japanese titles read in their own shades, so they can be told apart from English.
- A clip can be reported while its round plays.
- Score rows take two lines everywhere and keep their corners small in every world, with room at the sides.

### Removed
- The latency allowance: an answer's time is its arrival at the server, and First correct closes on the first right answer instead of waiting 150 ms.
- The line "The next round starts in a few seconds", and the count of who has answered under the cards (the scores column shows it).

## [1.14.0] - 2026-10-06

### Changed
- The round on a wide screen: the scores in a column left of the cards, and the answer in a column right of them, kept free from the round's start. On a phone the scores follow the cards and the answer comes last.
- The reveal moves nothing: the slot above the cards holds the longest verdict's height, each card the height of its back, and the lines under the cards keep their height. Splash Page's right panel settles back to its size.
- The answer's cover sits above its title, set to the right.
- The cards grow into the space the headphones left.

### Removed
- The headphones and their rings above the cards. A line under the cards says when the clip is loading or failed to load.
