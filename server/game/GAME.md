---
status: verified
last-verified: 2026-09-29
---

# Game: lobbies and questions

Entry: `server/game/questions.ts`. `buildGame(catalog, settings, random, playedThemeIds)` turns a lobby's settings into a game's questions: the song, the sample start and the four options. `replacementQuestion` draws another one when a round's clip can't be cut ([CLIPS.md](../clips/CLIPS.md)). The rules: [questions](../../docs/product-specs/questions.md) and [lobby](../../docs/product-specs/lobby.md).
- `lobby.ts`: a lobby's seats, host, lock and settings, as pure functions (`addPlayer`, `connectPlayer`, `removePlayer`, `kickPlayer`), plus the grace and expiry rules.
- `registry.ts`: `LobbyRegistry` holds this process's lobbies and sessions. It makes codes, ids and tokens, enforces the caps, sweeps expired seats and lobbies, and reports every change to the realtime layer ([REALTIME.md](../realtime/REALTIME.md)).
- `pool.ts`: which themes the settings allow (`eligibleThemes`), which anime may be options (`optionUniverse`), the pool size the lobby shows (`poolSize`), and what the settings may choose from (`settingsBounds`).
- `distractors.ts`: the three wrong options. Its `LEVELS` table holds each difficulty's match rule and relaxation steps.
- `titles.ts`: the option titles in all three languages, and `canShareOptions`, which decides when two anime can appear in one question.
- `random.ts`: the `Random` interface, with `secureRandom` for live games and `seededRandom` for tests, plus `pick` and `shuffle`.
- `../catalog/load.ts`: reads `catalog.sqlite` into memory at startup, and refuses a catalog of another schema version.

## Rules
- Lobby changes go through the functions in `lobby.ts`, and only `LobbyRegistry` stores their results. The registry is the only holder of session tokens, and it forgets a token when its seat goes.
- The host is the first seat. When the host's seat goes (leave, or 60 s gone), the player connected longest takes over. A lobby left without a connected player gets the next one who connects.
- Settings arrive already validated against `settingsBounds` (`shared/settings.ts`). Genres with fewer than `MIN_GENRE_THEMES` playable themes aren't offered, and the catalog gate warns about them.
- Everything random takes a `Random` argument. Live games pass `secureRandom`. Tests and the catalog check pass `seededRandom(seed)`, so a run repeats.
- A `Question` holds the answer (`animeId`, `correctIndex`, `clip.relPath`). A round sends clients only the option titles, never the question itself ([anti-cheat](../../docs/design-docs/anti-cheat.md)).
- The options' franchises never point at the answer: four franchises, or on Hard two pairs. Any change to the distractor rules keeps this, and the property tests check it.
- Distractors come from `optionUniverse` first. Single options fall back to the whole catalog only when it runs out. Hard's pairs never fall back, since an option from outside the filters would mark its pair as the wrong one.
- The lobby checks `poolSize` before a game. If `buildGame` throws because the pool has fewer anime than the game needs, that is a programming error.
- The sample bounds are `LEAD_IN_MS` and `TAIL_MS`, and the preset cuts are `DIFFICULTY_CUTS`, all in `pool.ts`.

## Gotchas
- Popularity comes two ways. `popularityPct` is a percentile among playable anime, from 0 (most popular) to 1. `popularityRank` starts at 1 for the most popular. Custom filters by rank, while the distractor bands compare percentiles.
- The universe is not the pool. `optionUniverse` applies only the anime filters (years, genres, formats), so an anime whose themes are all filtered out can still be an option.
- Titles are compared after `normalizeTitle` (NFKC, case, spacing). Two entries with one title and one year can never share a question, so Hard skips such a sibling.
- An anime without a year, or with a format outside the list, passes the filters only while that filter is wide open.

## Tests
`tests/game/*.test.ts`:
- `questions.test.ts` builds 10,000 seeded questions per difficulty from `syntheticCatalog()` and checks each against the spec's acceptance criteria. `syntheticCatalog()` lives in `tests/game/fixtures.ts` and is shaped like the real catalog: franchises of every size, remakes that share a title, songs shared within and across franchises, and missing titles.
- `pool.test.ts`, `titles.test.ts` and `random.test.ts` cover the filters, the title rules and the generators on small hand-made catalogs.
- `lobby.test.ts` covers the seat, host and expiry rules. `registry.test.ts` runs the registry on a fake clock, including its caps, events and sweep.
- `tests/catalog/load.test.ts` writes a catalog to a temporary folder with the build's own writer, then loads it.
- `tests/shared/scoring.test.ts` holds the scoring table of cases.
