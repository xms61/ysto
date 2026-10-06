# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

## [1.10.0] - 2026-10-05

### Changed
- The cards never move from the deal to the reveal, on a phone or a desktop: the space above them keeps the height of the world's countdown and timer, and the verdict takes the timer's place.
- From 64rem a side column sits beside the cards for the whole round: the scores and who has answered, then at the reveal the answer, the scoreboard, the reactions and the report, so the reveal needs no scroll. The cards' height follows the window, so a laptop shows both rows.
- Who picked each card shows on the card's edge in larger name chips, and the scoreboard shows the card each player picked.
