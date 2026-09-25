---
status: draft
last-verified: 2026-09-25
---

# Game flow

## Goal
A group plays a full game together: every player hears each sample at the same time, answers on their own device, and sees the same reveal and final results.

## Behavior
Home → create a lobby, or join one with a code and a name ([lobby](lobby.md)) → lobby (players, host settings, live pool size) → countdown → N rounds → results (podium and stats) → play again in the same lobby. A lobby with one player is solo play.

Every device plays the clip. A round runs like this:
```
server                                              clients
 | pick theme, sample offset, 4 options (kept here)  |
 | cut the clip with ffmpeg, issue a clip token      |
 |-- round:prepare { roundId, clipToken } ---------->| fetch and decode the clip
 |<- round:ready { roundId } ------------------------| barrier: everyone ready, or 8 s
 |-- round:start { startsAt, endsAt, options[4] } -->| play at startsAt, show the options
 |<- answer { roundId, option: 0-3 } ----------------| the first answer locks
 | close at endsAt, when everyone has answered, or   |
 |   at the first correct answer in First correct    |
 |-- round:reveal { correct, anime, song, scores } ->| about 7 s; the next clip is already cut
```
- `startsAt` is about 1 s after the barrier, so every client has the message before the clip starts.
- The sample plays for the whole answer window, which equals the sample length.
- The reveal shows:
  - the right option, and the anime in English, romaji and Japanese
  - OP or ED and its number
  - the song title and artists, and the year and season
  - the cover
  - each player's pick and points
- A player whose clip fails to load can still answer. The reveal marks them "no audio", with no penalty.
- The results show the podium, each player's correct answers, average time and best streak.

## Acceptance criteria
- All players see the options at `startsAt`, and none before.
- A round ends at `endsAt`, as soon as everyone has answered, or at the first correct answer in First correct ([scoring](scoring.md)).
- The next round starts right after the reveal, without waiting for a clip to be cut.
- "Play again" keeps the players and settings, and avoids the themes already played.
- A game of 15 songs with 20 s samples takes about 7 to 8 minutes.

## Out of scope
- Party mode, where one screen plays the audio and phones only answer.
- Pausing a running game.
