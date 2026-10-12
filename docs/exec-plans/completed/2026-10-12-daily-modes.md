# Three daily challenges: openings, endings, both

## Purpose
Each UTC day offers three dailies instead of one: ten openings, ten endings, and ten of either (today's daily). A player can play all three, each with its own streak on the device, and share each result. To see it working: on the home screen "Today's challenges" lists Openings, Endings and Both, each with its streak; playing Endings gives ten ending songs and a result headed "Daily #42 · Endings"; afterwards the home screen marks Endings played and still offers the other two.

## Context
- Spec: [daily.md](../../product-specs/daily.md). Settings and theme kinds: [settings.md](../../product-specs/settings.md), `THEME_KINDS` in `shared/settings.ts`.
- Day number and fixed settings: `shared/daily.ts` (`dailyNumber`, `dailySettings`).
- Seed and questions: `server/game/daily.ts` (`dailySeed`, `dailyQuestions`), called from `Games.start` in `server/game/games.ts`, which checks `poolSize` first.
- Lobby: `Lobby.daily` in `server/game/lobby.ts`, `LobbyRegistry.createDaily` in `server/game/registry.ts`, `LobbyState.daily` in `shared/protocol.ts`, sent by `server/realtime/hub.ts`.
- Routes: `GET`/`POST /api/daily` in `server/http/api.ts` ([REALTIME.md](../../../server/realtime/REALTIME.md)).
- Client: `DailyPanel` and `DailyResult` in `src/components/Daily.tsx`, `DailyLobby` in `src/screens/Lobby.tsx`, `createDaily` in `src/realtime/api.ts`, `playDaily` in `src/screens/Home.tsx`, the streak in `src/daily/streak.ts`.
- Constraints: `ysto_daily` is a released storage key, so it keeps its name and existing records still read ([FRONTEND.md](../../FRONTEND.md)). The secret stays the only source of unpredictability ([SECURITY.md](../../SECURITY.md)). Tests use `syntheticCatalog()`, never the real library ([TESTING.md](../../TESTING.md)).

## Plan
1. **Shared mode.** In `shared/daily.ts` add `DAILY_MODES = ['openings', 'endings', 'both'] as const` and `DailyMode`, and give `dailySettings(bounds, mode)` the mode's `kinds` (`['OP']`, `['ED']`, both). Everything else stays fixed.
2. **Seeds and questions.** `dailySeed(secret, number, mode)`: `both` keeps today's input `daily:${number}`, so a deploy mid-day doesn't change the songs of players who already played; the others use `daily:${number}:${mode}`. Each mode is drawn on its own, so one song can appear in two dailies of a day. Tests in `tests/http/daily.test.ts`: each mode is deterministic, gives only its kind, differs from the others, and `both` gives the same songs as before for the same secret and day.
3. **Lobby and protocol.** `Lobby.daily` and `LobbyState.daily` become `{ number, mode }`; `createDaily(name, ip, number, mode)` stores `dailySettings(bounds, mode)`; `Games.start` passes `lobby.daily.mode`. `parseDailyBody` in `shared/protocol.ts` validates the route's body.
4. **Routes.** `POST /api/daily` reads `mode` from the body next to `name`: missing means `both` (a tab opened before the update still works), an unknown value or an extra field is `invalid-request`. `GET /api/daily` stays as it was. Tests: each mode opens a locked lobby with its settings; a bad mode is refused; still one creation each against the per-address limit.
5. **Three streaks on the device.** `ysto_daily` holds one record per mode, `{ openings, endings, both }`, each the current `DailyRecord` (last day, streak, best, last game, practice). `readDaily` still reads today's flat record and treats it as `both`, so players keep the streak they have; the other two start empty. `readDaily(storage, mode)`, `currentStreak` and `recordDaily(storage, mode, day, game)` work on one mode's record and leave the others untouched: the next day in a row extends that mode's streak, a gap restarts it, a second play of the mode on a day is practice, and a reload at the results counts nothing. Badges stay per streak (7, 30, 100). Vitest cases in `src/daily/streak.test.ts`: the modes count apart, an old flat record becomes `both`, and a broken record reads as empty.
6. **Share text.** `shareText` takes the mode: the second line becomes "Daily #42 · Openings" / "Endings" / "Both", and the fire emoji shows that mode's streak. No song is named; the grid and score line stay. No combined text for all three.
7. **Home panel.** `DailyPanel` stays one panel: "Today's challenges" and the day's number once, then a row per mode (Openings, Endings, Both) with its streak line, its badge and its button, which offers practice once that mode is played today. `playDaily(mode)` in `Home.tsx` passes the mode to `createDaily`. `DailyLobby` and `DailyResult` show the mode next to the number ("Daily No. 42 · Endings"). The labels live next to the streak in `src/daily/streak.ts`.
8. **Browser test.** `e2e/daily.spec.ts` plays the Openings daily from the home screen, sees "Daily No. N · Openings" and a one-day streak, then sees Openings offered as practice while Endings and Both are still offered to play. Playing all three would take three full games; one is enough to prove the counting, the rest is covered by the unit tests.
9. **Docs and release.** Update [daily.md](../../product-specs/daily.md) (behavior and acceptance criteria), [REALTIME.md](../../../server/realtime/REALTIME.md) (the `mode` body field), [FRONTEND.md](../../FRONTEND.md) (`ysto_daily` now holds a record per mode), the README's summary line, and set `last-verified`. Minor version bump with a CHANGELOG entry and a `src/whats-new.ts` line ("Three dailies a day: openings, endings, or both."). Follow [RELEASE_PROCESS.md](../../../.github/RELEASE_PROCESS.md).

## Progress
- [x] 2026-10-12 Design questions answered (streak rule, home layout, overlap, share)
- [x] 2026-10-12 Shared mode and fixed settings per mode
- [x] 2026-10-12 Seeds and questions per mode, with tests
- [x] 2026-10-12 Lobby, protocol and registry carry the mode
- [x] 2026-10-12 The route takes the mode, with tests
- [x] 2026-10-12 A streak per mode, old records read as Both, with tests
- [x] 2026-10-12 Share text names the mode
- [x] 2026-10-12 Home panel, daily lobby and result show the three modes
- [x] 2026-10-12 Browser test plays one mode and sees the others still open
- [x] 2026-10-12 Docs, CHANGELOG, What's new, version bump (1.30.0)

## Decision log
- 2026-10-12: Both keeps the seed input `daily:${number}`, because changing it would swap today's songs for players who already played. Rejected: one new scheme for all three modes.
- 2026-10-12: The mode travels in the `POST /api/daily` body and defaults to `both`, because a tab loaded before the release posts without it. Rejected: a route per mode.
- 2026-10-12: Each mode keeps its own streak and best, as the owner chose. Rejected: one streak that any daily keeps alive; a day that counts only once all three are played.
- 2026-10-12: `ysto_daily` holds a record per mode and reads an old flat record as Both, because released keys are permanent and today's streaks must survive. Rejected: a new key per mode.
- 2026-10-12: Each mode is drawn on its own seed, as the owner chose, so a song may appear in two dailies of a day. Rejected: drawing Both first and keeping its songs out of the other two.
- 2026-10-12: One home panel with a row per mode, and a share text per daily, as the owner chose. Rejected: three cards; a combined share of all three.
- 2026-10-12: `GET /api/daily` doesn't list the modes, because the client and server ship together and `DAILY_MODES` is shared. Rejected: a `modes` field nothing would need.
- 2026-10-12: The buttons read "Play" or "Practice" with the daily's name as their accessible name ("Play Openings"), so the three rows stay short. Rejected: full sentences per button.
- 2026-10-12: A row keeps its button on the right at phone width and wraps its text instead, because a 7-day badge pushed the button onto a line of its own. Rejected: letting the row wrap.

## Surprises
- The browser tests' fixture catalog (`e2e/fixture-data.ts`) has only openings, so an Endings daily can't start there (`pool-too-small`). The browser test plays Openings; the unit tests cover Endings on `syntheticCatalog()`, which has both kinds.

## Validation
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:web`.
- `node --test tests/http/daily.test.ts`: three modes, each deterministic and of its kind.
- `npm run build && npm run test:e2e` (the daily spec plays Openings and sees the other two still open).
- `node scripts/check-docs.mjs` passes.
- By hand with `npm run dev` and a `YSTO_DAILY_SECRET` set: play Openings, then Endings, then Both; each mode shows its own one-day streak, a second Openings play says practice and leaves the streaks as they were, and each share text names its mode.

## Outcome
Shipped in 1.30.0: three dailies a day (Openings, Endings, Both), each the same for everyone, each with its own streak on the device, shown on the home screen as one panel with a row per daily and shared as "Daily #N · <daily>". Both keeps the old seed and the old streak. Checked with the server and client tests, the browser tests in Chromium and Firefox, and by hand on the fixture server at desktop and phone width (an old single streak showed as Both's 7-day streak). Not done: a combined share of all three, and keeping a song out of two dailies of a day, both declined. Follow-up: none.
