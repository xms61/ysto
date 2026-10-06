# Answer changes and overtime

## Purpose
A host can let players change their answer while a round is open. Once every player has answered, the round doesn't close at once: an overtime of a few seconds (the host picks how many) gives everyone a last chance to switch, and each theme world shows it in its own way. When someone switches, the others see a nudge ("Mio switched") but never the option. To see it working: turn on "Answers can change" in the lobby, play a round with two players, answer on both, and watch the overtime run before the reveal.

## Context
- Specs: [scoring](../../product-specs/scoring.md) ("each player locks in one answer per round"), [game flow](../../product-specs/game-flow.md), [settings](../../product-specs/settings.md).
- Server: `server/game/engine.ts` (`onAnswer`, `recheck`, `closeRound`, `catchUp`), [GAME.md](../../../server/game/GAME.md); `shared/settings.ts` (`LobbySettings`, `validateSettings`); `shared/protocol.ts` (server messages); [REALTIME.md](../../../server/realtime/REALTIME.md) (message limits).
- Client: `src/realtime/` (the game store and `ClientRound`), `src/screens/Round.tsx` (`Answering`, `TimeLeft`, the readouts), `src/components/SettingsForm.tsx`, `src/components/SettingsSummary.tsx`, `src/styles.css`, [DESIGN.md](../../DESIGN.md) (the worlds), [FRONTEND.md](../../FRONTEND.md).
- [Anti-cheat](../../design-docs/anti-cheat.md): the server never tells a player another player's option before the reveal.

## Rules (decided with the owner on 2026-10-05)
- A lobby setting, off by default: "Answers can change". With it on, a player can pick another option until the round closes; the last pick counts.
- When every connected player has answered, an overtime starts instead of the reveal. Its length is a lobby setting, 3 to 10 s, 5 s by default. It is one fixed countdown: a switch doesn't restart it. It never runs past the clip's end; whatever comes first closes the round.
- Other players see a nudge when someone switches: that player's name, never the option.
- Each theme world animates the overtime in its own way, with motion only under the player's motion setting.

## Decisions taken without the owner (open to change)
- In Speed, a switched answer's response time is the time of the switch, so switching costs points like answering late does. Counting the first answer's time instead would let a player tap anything at once and switch at leisure for full speed points.
- First correct ignores the setting: its first answer locks, as a buzzer does. The form says so when that mode is picked.
- The presets don't change the setting. Picking Classic, Buzzer or Chill leaves it as it was.
- A player who reconnects during a round gets their own pick back, so they can see what they would switch from.

## Plan
1. **Engine, protocol and settings** (one PR, minor): `answerChanges` and `overtimeSec` in `LobbySettings` with their limits; `onAnswer` replaces a pick with the switch time; overtime once everyone connected has answered (and again after a drop leaves only answered players); `round:overtime { roundId, startsAt, endsAt }`, `round:switched { roundId, playerId }` and a private `round:pick { roundId, option }` on catch-up. Engine tests on the fake clock for each rule, a realtime test over sockets. Client: the store, cards that stay pickable, the nudge line, a plain overtime banner and countdown that every world shows, the settings form and summary. Specs, GAME.md, REALTIME.md.
2. **Overtime in each world** (one or more PRs): each of the fifteen worlds shows the overtime in its own voice and motion, in the style of its readout. Copy and motion proposed per world in DESIGN.md, checked by screenshots on a phone and a desktop with motion full and reduced.

## Progress
- [x] 2026-10-05 Rules decided with the owner
- [x] 2026-10-05 Engine, protocol and settings, with the plain overtime in every world (1.2.0)
- [x] 2026-10-06 Overtime in each world, for the eight worlds left (1.20.0)

## Decision log
- 2026-10-05: An overtime after the last answer, rather than closing at once or always running to the deadline, because it gives everyone a fair last look without making every round run its full length. Rejected: closing at the last answer (an early answerer could never react to the others), running every round to the deadline (slow when everyone is sure).
- 2026-10-05: One fixed overtime whose length the host sets, rather than one a switch restarts, because a restart lets one player stall the round. Rejected: a switch restarting the countdown, a fixed 5 s.
- 2026-10-05: A nudge on a switch, naming the player but not the option, because it builds tension and gives nothing away. Rejected: silent switches.

## Surprises
- 2026-10-06: Neon Rain's LED had lost its dark glass when Tokyo Rain and Konbini merged (`--glass` was theirs), and overriding its color through a token that referred back to `--accent` made a cycle that blanked it; the readout now sets its color directly.

## Validation
- `npm run test:ci`: the engine tests cover a switch, a switch's response time, the overtime start, its cap at the clip's end, First correct ignoring switches, a drop that completes the answers, and catch-up.
- `npm run build && npm run test:e2e`: the whole-game test still passes; a two-player round with switching on runs its overtime.
- Screenshots of the overtime in every world, phone and desktop (eight worlds by the time it shipped).

## Outcome
Players can switch until the round closes, and an overtime of 3 to 10 s gives everyone a last look once all have answered; switches nudge the others without the option. Each world prints the overtime's call on its own material and beats it in its own way (DESIGN.md, The overtime). The worlds shrank from fifteen to eight while it was owed, so it shipped for those eight.
