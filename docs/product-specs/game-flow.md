---
status: draft
last-verified: 2026-10-06
---

# Game flow

## Goal
A group plays a full game together: every player hears each sample at the same time, answers on their own device, and sees the same reveal and final results.

## Behavior
Home → create a lobby, or join one with a code and a name ([lobby](lobby.md)) → lobby (players, host settings, live pool size) → countdown → N rounds → results (the standings and stats) → play again in the same lobby. A lobby with one player is solo play.

Every device plays the clip. A round runs like this:
```
server                                              clients
 | pick theme, sample offset, 4 options (kept here)  |
 | cut the clip with ffmpeg, issue a clip token      |
 |-- round:prepare { roundId, clipToken } ---------->| fetch and decode the clip
 |<- round:ready { roundId, loaded } ----------------| barrier: everyone ready, or 8 s
 |-- round:start { startsAt, endsAt, options[4] } -->| play at startsAt, show the options
 |<- answer { roundId, option: 0-3 } ----------------| the first answer locks
 | close at endsAt, when everyone has answered, or   |
 |   at the first correct answer in First correct    |
 |-- round:reveal { correct, anime, song, scores } ->| about 7 s; the next clip is already cut
```
- `startsAt` is 1 s after the barrier, so every client has the message before the clip starts. The first round waits 3 s instead: the game's countdown.
- Only connected players hold up the barrier, or end a round early by all answering. If nobody is connected when a barrier runs out, the game ends.
- A round whose clip fails on three themes is dropped, and the game plays on with one round fewer.
- A player who reconnects during a round gets the round again, and the reveal if it is showing. A player who joins during a game sees and hears the rounds, then plays from the next one.
- "Play again" is the host starting the next game from the results.
- The sample plays for the whole answer window, which equals the sample length.
- **Answer changes** (a lobby setting, off by default; never in First correct): a player can pick another option until the round closes, and the cards stay open after a pick. When every connected player has answered, the round doesn't close: an overtime of 3 to 10 s (the host's choice, 5 s by default) starts, with the theme's call "Overtime" and its time readout counting the overtime down. Anyone can still switch; a switch doesn't restart it. It never runs past the clip's end. Each switch shows the others "Mio switched", never the option. A player who reconnects gets their own pick back.
- The cards keep their place and size from the deal to the reveal; the verdict takes the timer's place. On a wide screen the scores sit left of the cards for the whole round (who has answered, then each player's pick and points), and the answer fills a column kept free right of them at the reveal, so nothing moves and nothing needs a scroll; on a phone the scores follow the cards and the answer comes last. A line above the cards says when this player's clip is loading or failed to load. On a wide screen the whole round fits the window, with no scroll, and the cards fill the middle column's height, a long title shrinking to fit its card.
- The reveal shows:
  - the right option, and the anime in English, romaji and Japanese
  - OP or ED and its number
  - the song title and artists, and the year and season
  - the cover
  - who picked each option, as each picker's animal stamped down its card's right side, wholly inside the card (named for screen readers and on hover), and on the scoreboard as the number of the card each player picked, shown only once the round has closed for everyone
  - each player's pick and points, and for a player who missed the song, with a wrong answer or none, "You skipped the OP?!" (or the ED)
- A player whose clip fails to load can still answer. The reveal marks them "no audio", with no penalty.
- The results bill the standings like a festival lineup, announced from the bottom up, the winner's full name largest, with each player's correct answers, average time and best streak. Players on the same score share a place, at the reveal and in the results. The lobby state keeps them until the next game, so a player who reloads on the results sees them again.
- **Elimination** (Play → Elimination in the settings, with 1 to 5 lives, 3 by default): a wrong answer or no answer costs a life; a skipped round, or a round whose clip failed to load for that player, costs none. A player with no lives left is out: their row reads "out", their cards stay closed, and they watch the rest ("You're out. Watch who lasts."); the rounds no longer wait for them. The game ends after the reveal that leaves one player standing, or when the songs run out, and ranks by lives, then by points. Played alone, it is survival: the game runs until the lives or the songs run out. Score rows show each player's lives. A player who joins during an Elimination game watches it out, since starting with full lives would not be fair. Elimination can't use First correct, which gives everyone but the fastest nothing; picking Elimination moves a Buzzer game to Classic scoring. Endless works with it: rounds come until one player is left.
- **Teams** (Play → Teams, with 2 to 4 teams, 2 by default): the teams are Kitsune, Tanuki, Tengu and Kappa, each marked by a dot in one of the world's own colors. A new player joins the smallest team; in the lobby each player picks their team, and the host can move anyone or "Shuffle the teams", which deals everyone out evenly at random. Fewer teams in the settings move the players of the teams that go to the smallest teams left. Teams can't change while a game runs. A team's score for a round is the average of its connected members' points, so a team of two can beat a team of four; a member who dropped counts for neither side. Players still score as in Classic. The scores column and the reveal show the teams' totals above the players, each player's team beside their name; the results bill the teams, best first, with each member's points under their team, above the players' bill. A player who joins mid-game plays for the team the lobby gave them from the next round.
- **Typed answers** (Answer by → Typing, next to the default of tapping one of the four options): an anime round shows a field in place of the cards. As the player types (two characters or more, 150ms after the last key), the server suggests up to eight anime from the whole catalog, matched on all three titles and the synonyms, the closest match first and then the most popular, each with its year so that remakes can be told apart. Picking a suggestion answers; Enter answers too when the text names exactly one suggestion, and otherwise asks the player to pick one. Only the exact anime is right. Answer changes, every scoring mode, hints, the penalty, Elimination and Teams work as with the cards; the keys 1 to 4 don't pick in a typing round. The reveal lists what each player typed, right or wrong, in place of the cards. Typing names an anime, so a song title or artist game can't use it, and in a Mixed game its song title and artist rounds still show four options.
- **Party mode** (Play → "Party mode: sound on one screen", off by default): the sound plays on a screen that joined by the link (see [lobby](lobby.md)), not on the phones. The screen loads and plays every clip and shows the round, the reveal and the results, with the join code's QR in its corner all through the game, and "This screen plays the sound. Answer on your phones." where a player's status would be. The phones show the options and their answer state as usual, with the titles, but load and play no clip and offer no sound button. The round's barrier waits only for the screens' clips, and no player is ever marked "no audio". A party game doesn't start without a connected screen (`no-screen`); if the screen drops mid-game, the barrier waits for it as long as for any player and then starts the round anyway.
- **Endless:** with "Endless" on in the settings, the number of songs doesn't apply: rounds keep coming until the host ends the game with "End the game", in any phase (a round still running doesn't count), or until no anime matching the settings is left unplayed in the game. The heading reads "Round 7" without a total, and the results count the rounds played. A player who joins mid-game plays from the next round, as in any game. An endless game stays out of the [game log](game-log.md).
- Below the standings, folded away, "Songs this game" lists every round's song in the order it played (a skipped round's too, marked): the anime in the player's title languages, OP or ED and its number, the song title and artists, when it aired, and a link to the anime's page on AnimeThemes, opening in a new tab without a referrer. The game then goes into the player's [game log](game-log.md).
- **Hints** (a lobby setting, off by default): from halfway through the answer window, a "Hint: when it aired (70% of the points)" button sits under the round's status. A player who takes it, and only that player, sees when the anime aired, such as "Aired: TV, Spring 2013"; a right answer then scores 70%. One hint per round; a player whose answer is locked in isn't offered one, since it could only cost them. The reveal's board marks who took one with "hint". The line keeps its height from the round's start, so the cards don't move when the button comes.
- **Report this clip:** all through a round, at the foot of the scores column, and in the results' song list, a player can report the round's clip with one of four reasons (silent or too quiet, wrong song, cut badly, something else). Each player reports a clip once per game; the control then reads "Reported. Thanks." The owner reads the reports ([DEPLOY.md](../DEPLOY.md#clip-reports)).
- The clip plays on through the reveal, and fades out when the next round is prepared, when the host skips, or when the game ends.

## Acceptance criteria
- All players see the options at `startsAt`, and none before.
- A round ends at `endsAt`, as soon as everyone has answered, or in First correct on the first correct answer to arrive ([scoring](scoring.md)). With answer changes on, everyone having answered starts the overtime instead, and the round ends when it does.
- The next round starts right after the reveal, without waiting for a clip to be cut.
- "Play again" keeps the players and settings, and avoids the themes already played.
- A game of 15 songs with 20 s samples takes about 7 to 8 minutes.

## Out of scope
- Party mode, where one screen plays the audio and phones only answer.
- Pausing a running game.
