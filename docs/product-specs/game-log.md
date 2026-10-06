---
status: draft
last-verified: 2026-10-06
---

# Game log

## Goal
A player can look back at the games they played on this device, and look up the shows they keep missing.

## Behavior
- "Your games" on the home screen opens the log. Back returns to the home screen.
- **Games:** each game this device finished, newest first: when it ended, the player's place among the players (or "Solo"), their score, and how many songs they got right. Folded under each game, its songs in the order they played: the anime in the player's title languages, OP or ED and its number, the song title, and "Right" or "Missed".
- **Anime log:** every anime heard in the logged games, once each: how often it played and how often the player picked it, most heard first, then most missed. Each links to the anime's page on AnimeThemes, opening in a new tab without a referrer.
- A game goes into the log when its results arrive, once, also for a player who reconnects to them. A player who only watched, a game where no round played, and an endless game are not logged.
- The log keeps the last 100 games. "Clear the log" empties it after a confirmation.
- The log stays on the device (`localStorage`, `ysto_history`): no account, nothing on the server. Without storage the screen shows an empty log, and the game plays as usual.
- The server says who picked each song right only in the results, once the game is over ([anti-cheat](../design-docs/anti-cheat.md)).

## Acceptance criteria
- After a game, "Your games" lists it with the player's place, score and right answers, and its songs with each marked right or missed.
- Returning to the same results logs the game once.
- The anime log counts an anime heard in two games twice, and right once when the player picked it once.
- The 101st game pushes out the oldest; "Clear the log" empties it.
- Blocked or garbled storage shows an empty log without an error.

## Out of scope
- Syncing the log between devices, or any server copy of it.
- Statistics across games beyond the counts above.
