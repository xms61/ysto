# Features after 1.0

## Purpose
Thirteen features the owner picked on 2026-10-05, and a fourteenth added the same day (M15, What's new), from the list after 1.0, built one milestone at a time. When they are done, a group can react to a reveal, look back at the game's songs and play on in the same lobby with a running tally. A host can save their favorite setups and pick from new ways to play: hints, elimination, teams, song title and artist rounds, and typed answers. A solo player can come back every day for the daily challenge and keep a streak going. A living room can put the audio on one TV while phones only answer. Each milestone says how to see it working.

Not in this plan, by the owner's choice: importing AniList or MyAnimeList lists, and translations of the interface.

## Context
- Specs: [game flow](../../product-specs/game-flow.md), [questions](../../product-specs/questions.md), [scoring](../../product-specs/scoring.md), [lobby](../../product-specs/lobby.md), [settings](../../product-specs/settings.md). Each milestone updates the specs it changes, or adds one (rules in the [specs index](../../product-specs/index.md)).
- Server: the engine and its rules ([GAME.md](../../../server/game/GAME.md)), the protocol and its limits ([REALTIME.md](../../../server/realtime/REALTIME.md)), the catalog ([CATALOG.md](../../../scripts/catalog/CATALOG.md); `anime.slug` and `synonyms_json` are in the database but not yet loaded by `server/catalog/load.ts`), clips ([CLIPS.md](../../../server/clips/CLIPS.md)).
- Client: [FRONTEND.md](../../FRONTEND.md), [DESIGN.md](../../DESIGN.md) (fifteen worlds: every new surface takes each world's tokens, type and motion), `src/prefs/prefs.ts` (device settings; released `ysto_*` keys never change), `src/audio/engine.ts`.
- Invariants that hold for every milestone: [anti-cheat](../../design-docs/anti-cheat.md) (no message tells a player the answer before the reveal); [SECURITY.md](../../SECURITY.md) (validated input, rate limits, no personal data kept); WCAG AA in every world, keys for every control, motion only under the motion setting; tests use no network and no real data ([TESTING.md](../../TESTING.md)).
- Deploy: the game container is read-only with no writable volume ([DEPLOY.md](../../DEPLOY.md), `deploy/compose.yml`). Milestone 3 adds the first one.
- Running alongside: the [answer changes plan](2026-10-05-answer-changes.md) still owes each world's own overtime animation.

## How the features fit together
New lobby settings group into three choices at the top of the settings form, so the form doesn't grow into one long list:

| Choice | Values | Default |
| :-- | :-- | :-- |
| Play | Free for all, Elimination, Teams | Free for all |
| Questions | Anime, Song title, Artist, Mixed | Anime |
| Answer by | Four options, Typing | Four options |

Plus toggles: hints, answer changes (shipped in 1.2.0), party mode.

Combinations the first version refuses, in the validator and the form alike (each can open up later):
- Typing only with Anime questions: matching typed song titles and artist names needs its own rules.
- Elimination doesn't run in First correct, where most players never get to answer before the round closes.
- Teams and Elimination are separate choices, not combined.
- The daily challenge has fixed settings, and none of these choices.

## Plan
Each milestone is one PR on a `feat/…` branch (two where noted), with a version bump, a CHANGELOG entry, updated specs and docs, and screenshots of every world on a phone and a desktop for any new surface ([release process](../../../.github/RELEASE_PROCESS.md)). Sizes: S is a session, M two or three, L more.

### Phase 1: small things that make a session with friends better

#### M1 Stale tabs reload (S, prerequisite)
- **Why:** most milestones add lobby settings or messages. A tab opened before a deploy sends settings the new server refuses, and misses new messages.
- **Behavior:** the server tells each socket its build version in `lobby:state`. A client of another version reloads itself, but never during a round: it waits for the lobby or the results. The session survives the reload, so the player keeps their seat.
- **Tests:** the client reloads on a version mismatch only outside a round.

#### M15 What's new (S, added 2026-10-05)
- **Behavior:** the first time a player opens a newer version, a small dialog says what changed for them, in at most three short lines ("Answers can change: ask your host to turn it on."), with one "Got it" button. Escape or a tap outside closes it too. It shows only on the home screen or in the lobby, never during a round or on the results. A device on its first visit gets nothing, because everything is new to it; it only notes the version.
- **Build:** the notes are written for players in `src/whats-new.ts`, by version, separately from the CHANGELOG, which is written for developers. A version with nothing a player would notice has no note, and then nothing shows. The device keeps the last version it saw under `ysto_seen_version`. Coming back after several versions shows the newest three lines across them.
- **Tests:** shown once for a newer version with notes; not on a first visit, not for a version without notes, never during a round; storage that is blocked doesn't show it on every load.

#### M2 The game's songs at the results (S)
- **Behavior:** below the standings, a "Songs this game" list: round number, the anime in the player's title languages, OP or ED and its number, song title and artists, and a link to the anime on AnimeThemes (`https://animethemes.moe/anime/<slug>`, new tab, `rel="noreferrer"`). A player who reconnects to the results sees it too.
- **Build:** load `anime.slug` in `server/catalog/load.ts`; the engine keeps each played round's reveal details; `game:results` and the results kept in `gameView` carry them. No catalog schema change.
- **Tests:** engine (the list follows the rounds played, without dropped ones), client (titles follow the languages, links are external and safe).

#### M3 Report a broken clip (S)
- **Behavior:** at the reveal and in the song list, "Report this clip" with fixed reasons: silent or too quiet, wrong song, bad cut, other. No free text, so nothing needs moderating. One report per player per song per lobby; the button then reads "Reported".
- **Build:** the first writable volume: `ysto_state` mounted at `/data/state` (`YSTO_STATE_DIR`), never renamed once released. Reports go into `reports.sqlite` there: time, theme id, clip offset, reason. No names, addresses or lobby codes. One report per player and round in each game, on top of the socket's message limit (built that way instead of a separate rate limit). `npm run reports` lists them grouped by theme for the owner. DEPLOY.md gets the volume and the command, and the owner copies the new `compose.yml` to the VPS.
- **Tests:** the route's validation, limits and deduplication on a temp directory; the store; the image check writes a report into its volume.
- **Later, not here:** an exclusion list the catalog gate reads, built from reports the owner confirms.

#### M4 The lobby's tally (S)
- **Behavior:** a lobby that plays several games keeps a tally: games played, wins per player (a shared first place counts for everyone in it), and total points. It shows in the lobby and on the results ("Ann has won 2 of 3"). It lasts as long as the lobby. A player who drops keeps their line, and one who leaves takes it with them.
- **Build:** the registry keeps the tally per lobby and updates it when a game finishes; `lobby:state` carries it.
- **Tests:** registry (wins, ties, leave, drop), client.

#### M5 Reactions (S)
- **Behavior:** during the reveal, on the results and in the lobby, a player taps one of six reactions: hype, laugh, shock, facepalm, heart, clap. Each is drawn as an original SVG icon, not emoji. The reaction rises from that player's name in the lineup, the pickers or the player list, in the world's colors, and only shows up in place when motion is reduced. Never during answering, so they can't signal options.
- **Build:** `reaction { kind }` from the player, `reaction { playerId, kind }` to everyone. The server limit is one reaction per second per player, and extras are dropped without a strike.
- **Tests:** the protocol's validation and limit, refused during a round, client rendering in the reduced and full motion settings.

#### M6 Saved settings (S)
- **Behavior:** the host saves the current settings under a name, up to eight per device, and loads one later in any lobby they host. Loading checks the saved settings against this catalog's bounds. A genre or year that no longer exists drops out, and the form says what changed.
- **Build:** client only, under the new key `ysto_saved_settings`.
- **Tests:** saving, loading, the bounds check, storage that is blocked or full.

### Phase 2: the game's sound

#### M7 Sound effects per world (M)
- **Behavior:** short sounds for the deal, a pick, the overtime's call, a right answer, a wrong one and the results. Each world has its own voice: a ticket machine's beep and print, a shop door's two-tone chime, a karaoke fanfare, an arcade blip, a shrine bell, and so on. A Preferences switch, "Sound effects", on by default, follows the game's volume.
- **Build:** synthesized at runtime with Web Audio, oscillators and envelopes from a small table per world, so there are no audio files to license or ship. They play through the engine's gain node, so the volume and the iPhone unlock apply.
- **Tests:** each world's table names every sound; nothing plays at volume 0 or with the switch off; e2e stays muted.
- **With:** the answer changes plan's per-world overtime animation can ship in the same pass, so the overtime's call gets its sound and its motion together.

### Phase 3: new ways to play

#### M8 Hints (S)
- **Behavior:** off unless the host turns on "Hints" in the lobby. Halfway through the answer window, a "Hint" button gives that player, and only them, when the anime aired, such as "TV, Spring 2013". A correct answer after taking a hint scores 70% of its points, streak bonus included. The reveal marks who used one.
- **Build:** `hint { roundId }` from the player, `round:hint { format, season, year }` to that player only; the engine records it; `shared/scoring.ts` applies the factor. A hint is the anime's own metadata, which the reveal shows anyway, so it never names the answer.
- **Tests:** scoring cases with a hint, the timing gate, refused when hints are off, one hint per round.

#### M9 Elimination (M)
- **Behavior:** Play → Elimination, with 1 to 5 lives (3 by default). A wrong answer or no answer costs a life. A skipped round, or a player whose clip failed, loses none. A player with no lives left watches the rest. The game ends when one player is left, or when the songs run out, ranked by lives and then by score. Solo, it is survival: play until the lives or the songs run out. Points still count, to break ties.
- **Build:** this milestone also restructures the settings form into Play, Questions and Answer by. Lives live in the game's standings; `round:reveal` and the standings carry lives and who is out; the results bill the last one standing.
- **Tests:** engine on the fake clock (lives, outs, the end conditions, a drop and a return), validator (no First correct), client.

#### M10 Teams (M)
- **Behavior:** Play → Teams, with 2 to 4 teams, each named and colored in the world's own palette. Players pick a team in the lobby, and the host can move players or shuffle them evenly. A team's score for a round is the average of its members' points, so a team of two can beat a team of four. The reveal and results bill the teams, with the members' points under each.
- **Build:** team assignment in the lobby, validated by the registry; team standings in the engine. A player who joins late lands on the smallest team.
- **Tests:** registry (assignment, shuffle, leave), engine (averages, uneven teams, a member who drops), client.

#### M11 Song title and artist rounds (M, two PRs)
- **Behavior:** Questions → Song title shows four song titles, and Questions → Artist shows four artist credits. Mixed draws each round's kind at random. The clip and the reveal are as before.
- **Build:** distractors of the same kind and popularity band. In song title rounds, no option shares the answer's song identity or title. In artist rounds, no option shares an artist with the answer's song, so a duet never makes two options right. Themes without a song title or artists don't count for those kinds. The pool count and the catalog gate cover the new kinds.
- **Tests:** property tests like the existing 10,000 questions per difficulty, per kind: four distinct options, exactly one right, no franchise tell.

#### M12 Typed answers, an alternative to the four options (L, two PRs)
- **Behavior:** Answer by → Typing, offered next to the four options, not instead of them. The cards give way to a field. As the player types, suggestions come up from every playable anime's titles in all three languages and its synonyms, each with its year so that remakes can be told apart. Submitting a suggestion answers; free text that matches exactly one anime's title counts as that anime. Only the exact anime is right. Answer changes, scoring modes, hints and the penalty work as with the cards. The reveal shows what each player typed, matched to a title.
- **Build:** the suggestions come from a title index of the whole catalog, never the round, so they can't hint at the answer. Before building, measure whether shipping the index is small enough once compressed, or whether the server should search instead, with a rate limit. Matching uses the server's `normalizeTitle`. A new message, `answer { roundId, animeId }`, is validated against the catalog. Synonyms load from `synonyms_json`.
- **Tests:** matching (case, width, punctuation, synonyms, remakes), the engine with typed answers in each scoring mode, the leak test (the index never depends on the round), e2e on a phone keyboard.

### Phase 4: coming back, and the living room

#### M13 Daily challenge with a streak (M)
- **Behavior:** "Today's challenge" on the home screen: the same 10 songs for everyone each day, played solo. The day changes at 00:00 UTC, and each day is numbered ("Daily No. 42"). The settings are fixed: Normal, 15 s samples, Speed with streak bonus, four options, the same sample starts for everyone. The result is the score, the right answers and a grid of the ten rounds. It can be shared as text that gives no song away, made of plain block characters and not emoji: "You Skipped The OP?! Daily No. 42 · 8/10 · 7,450 · day 12", then a line such as `■■□■■■·■■■`.
- **Streak:** the home screen and the result show how many days in a row this device has played the daily. Missing a day starts it again from 1, and the best streak is kept beside it. At 7, 30 and 100 days the streak gets a world-drawn badge. Only the first play of a day counts; replays are marked as practice. Without accounts, the streak lives on the device (`ysto_daily`), so clearing the browser's data resets it.
- **Build:** the day's questions come from `buildGame` with fixed settings and a seed derived from the date and a server secret, `YSTO_DAILY_SECRET`. The code and the catalog's sources are public, so a public seed would let anyone list the answers in advance. Without the secret, the daily is switched off. The same catalog gives the same daily after a restart, and clips are cut on demand as now. A daily runs as a private one-player lobby that no one can join.
- **Tests:** seeding (the same date and secret give the same questions, the next day's are different), the streak (consecutive days, a missed day, the UTC boundary, practice replays, storage that is blocked), the share text, e2e of one daily.
- **Later, not here:** a transfer code to carry a streak to another device, and a daily leaderboard of names.

#### M14 Party mode (M, two PRs)
- **Behavior:** a lobby setting, "Party mode: sound on one screen". A TV or laptop joins the lobby as a screen, through a "Use as the screen" button on the join page. It doesn't play: it plays the clip, shows the round, the cards, the reveal and the results large, and keeps the join QR code in a corner. Phones show the options and their answer state, without loading or playing clips. At most two screens per lobby, and screens don't count toward the 12 players.
- **Build:** a screen seat, which can fetch clips but never answers or scores. In party mode, the barrier waits only for the screens' clips; the phones report ready without loading, and they are never marked "no audio". Without a connected screen the game doesn't start, and if the screen drops mid-game the barrier waits for it as long as for any player.
- **Tests:** registry (screen seats, caps, host rules unaffected), engine (the barrier in party mode, no-audio marks), e2e with one screen and two phones.

## Progress
- [x] 2026-10-05 Features picked and shaped with the owner; plan written
- [x] 2026-10-05 M1 Stale tabs reload (1.3.0)
- [x] 2026-10-05 M15 What's new (1.5.0)
- [x] 2026-10-05 M2 The game's songs at the results (1.4.0)
- [x] 2026-10-05 M3 Report a broken clip (1.6.0)
- [ ] M4 The lobby's tally
- [ ] M5 Reactions
- [ ] M6 Saved settings
- [ ] M7 Sound effects per world
- [ ] M8 Hints
- [ ] M9 Elimination
- [ ] M10 Teams
- [ ] M11 Song title and artist rounds
- [ ] M12 Typed answers
- [ ] M13 Daily challenge with a streak
- [ ] M14 Party mode

## Decision log
- 2026-10-05: The owner picked thirteen of the fifteen suggestions, leaving out list imports and interface translations. Typed answers become an alternative way to answer, not a replacement for the four options. Hints exist only when the lobby turns them on. The daily challenge shows a streak of the days played in a row.
- 2026-10-05: The order runs from small changes that improve a session with friends (M1–M6) to sound, then new modes, then the daily and party mode, because a playtest can start after phase 1 and its findings may reshape the modes. Rejected: building the daily first (it needs the most new parts: a seed secret, a solo lobby, device storage).
- 2026-10-05: The owner added M15, a short "What's new" dialog on a player's first visit after an update. It follows M1, which gives the page its version. Its notes are written for players, apart from the CHANGELOG, because the CHANGELOG is written for developers and is too long for a dialog.
- 2026-10-05: Stale tabs reload (M1) comes first, because nearly every later milestone changes the settings or the protocol, and the validator refuses an old tab's settings.
- 2026-10-05: Sound effects are synthesized with Web Audio rather than shipped as files, because files would need licensing and space, and a table per world is easy to tune. Rejected: CC0 sample packs.
- 2026-10-05: The daily's seed takes a server secret, because the code and the catalog's sources are public. Rejected: a seed from the date alone.
- 2026-10-05: The streak lives on the device, because the game has no accounts and keeps no personal data. Rejected: a server-side streak, which would need an identity.
- 2026-10-05: Reports keep no names, addresses or lobby codes, because nothing about a report needs them, and SECURITY.md keeps no personal data. Rejected: free-text reports, which would need moderating.

## Open questions
Each has a default the milestone builds unless the owner decides otherwise:
- M5: the six reactions. Default: hype, laugh, shock, facepalm, heart, clap.
- M8: what a hint shows, and what it costs. Default: format, season and year, at 70% of the points.
- M9: the lives. Default: 3, and a missed answer costs one, as a wrong one does.
- M10: a team's round score. Default: the average of its members' points; the alternative is the sum.
- M12: whether a sibling season counts as right ("Attack on Titan" for "Attack on Titan Season 3"). Default: only the exact anime.
- M13: the daily's settings and the day's boundary. Default: Normal, 10 songs of 15 s, a new day at 00:00 UTC (01:00 or 02:00 in Germany).
- M14: whether phones show the titles too. Default: yes, for accessibility and for players who sit far from the screen.

## Surprises
None yet.

## Validation
Each milestone lists its tests. Every PR passes `npm run test:ci`, the doc and tracked-files checks, and the browser tests (`npm run build && npm run test:e2e`), and posts screenshots of every world for new surfaces. After phase 1, the owner's playtest with friends, still open in the [tech-debt tracker](../tech-debt-tracker.md), checks the session features before phase 3 starts.

## Outcome
Filled in when this plan moves to completed/.
