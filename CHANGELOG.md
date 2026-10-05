# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] - 2026-10-05

### Added
- What's new: the first time a device opens a newer version, a small dialog says what changed for players in up to three lines, on the home screen or in the lobby. The notes live in `src/whats-new.ts`, written for players; a first visit shows nothing.

## [1.4.0] - 2026-10-05

### Added
- The results list the game's songs, folded away below the standings: each round's anime in the player's title languages, OP or ED, the song and its artists, when it aired, and a link to the anime on AnimeThemes.
- The features plan gains M15, a short "What's new" dialog on a player's first visit after an update.

## [1.3.0] - 2026-10-05

### Added
- A page from an older version reloads itself after a deploy, in the lobby or on the results but never during a round, and keeps its seat. Before, an old tab's settings were refused by the new server.

## [1.2.1] - 2026-10-05

### Added
- An exec plan for the features after 1.0: the game's songs at the results, clip reports, the lobby's tally, reactions, saved settings, sound effects per world, hints, elimination, teams, song title and artist rounds, typed answers, a daily challenge with a streak, and party mode.

## [1.2.0] - 2026-10-05

### Added
- Answer changes: a lobby setting, off by default, lets players pick another option until the round closes. Once everyone has answered, an overtime of 3 to 10 s (the host picks, 5 s by default) gives a last chance to switch before the reveal: "Overtime" is called above the time left, and each world's timer counts it down. The others see who switched, never to what. A switch scores from the moment it is made, and First correct keeps the first answer as before.
