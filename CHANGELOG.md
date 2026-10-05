# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-10-05

### Added
- A page from an older version reloads itself after a deploy, in the lobby or on the results but never during a round, and keeps its seat. Before, an old tab's settings were refused by the new server.

## [1.2.1] - 2026-10-05

### Added
- An exec plan for the features after 1.0: the game's songs at the results, clip reports, the lobby's tally, reactions, saved settings, sound effects per world, hints, elimination, teams, song title and artist rounds, typed answers, a daily challenge with a streak, and party mode.

## [1.2.0] - 2026-10-05

### Added
- Answer changes: a lobby setting, off by default, lets players pick another option until the round closes. Once everyone has answered, an overtime of 3 to 10 s (the host picks, 5 s by default) gives a last chance to switch before the reveal: "Overtime" is called above the time left, and each world's timer counts it down. The others see who switched, never to what. A switch scores from the moment it is made, and First correct keeps the first answer as before.

## [1.1.0] - 2026-10-05

### Added
- A second title language: Preferences can show each option's title in a second language under the first, smaller (English with romaji, or English with Japanese, for example). A title that reads the same in both shows once, and the reveal lists the anime's other titles with the second language first.

### Changed
- The reveal no longer repeats a title that differs only in case, such as "Naruto" and "NARUTO".
- Older entries moved to the changelog archive.

## [1.0.0] - 2026-10-05

### Changed
- 1.0: the v1 plan is complete. The game runs on its VPS from the released image; the load test meets its targets and the security review has no high findings. The playtest with friends, the clip timing on the VPS and an external port scan follow (tech-debt tracker).
- The docs describe the running deployment: DEPLOY.md lists the open checks, SECURITY.md records the review, and the README's status is 1.0.
