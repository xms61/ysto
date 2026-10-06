# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

## [1.13.0] - 2026-10-05

### Added
- Your games: the home screen opens a log of the games this device finished, with the player's place, score and songs, and an anime log of every anime heard, how often, and how often the player got it, linked to AnimeThemes. Kept on the device, the last 100 games; "Clear the log" empties it.
- The results' song list names the players who picked each song right, sent once the game is over.

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
