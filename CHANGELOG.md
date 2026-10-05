# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

## [0.33.0] - 2026-10-05

### Added
- A load test, `npm run load`: 25 lobbies of 8 bots play whole games against a running server and check the targets in RELIABILITY.md (clips and event-loop lag at the 95th percentile). Three runs passed: every game finished, clips at p95 under 120 ms and ping round trips under 10 ms.

### Fixed
- A round that not everyone answered could stay open for good: Node can run a timer a millisecond before the clock reaches its time, the round's close was then ignored, and nothing tried again. Timers now wait out the rest.

## [0.32.0] - 2026-10-05

### Changed
- The catalog's AnimeThemes sync reads AnimeThemes' GraphQL API in place of its deprecated JSON:API. Pages are cached in the same shape as before and dumps still import, so builds don't change: three pages synced both ways parsed to the same 300 anime.
- Every opaque color in the themes is a named token in its theme block, including the backdrop's petals, twinkles and rain.

### Removed
- The shared timer bar. Every theme draws its own timer, and a new theme must name one.
