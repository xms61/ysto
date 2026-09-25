---
status: draft
last-verified: 2026-09-25
---

# Anti-cheat and score integrity

## Context
Players have devtools and can modify the client. The answer to the current round is the asset to protect, until the reveal. Other attacks are covered in [SECURITY.md](../SECURITY.md): strangers guessing lobby codes, and scripts flooding requests.

## Decision
1. **The server owns every decision:** the song, the sample offset, the options, the correct answer, the timer and the scores. Clients only render and send inputs.
2. **Nothing before the reveal identifies the song:**
   - The clip URL is an opaque random token.
   - No filename, theme, anime or song ID appears in any message or URL before the reveal.
   - The options are four strings in positions 0–3, with no database IDs.
   - The clip is re-encoded, so its bytes and length don't match the source file.
   - Metadata is stripped, and every clip is exactly the chosen length ([audio clips](audio-clips.md)).
3. **The options arrive with `round:start`**, not with the prepare message, so nobody can research them while the clip loads.
4. **One answer per player per round.** It's accepted between `startsAt` and `endsAt`, plus 300 ms of grace. Early, late and repeated answers are dropped.
5. **The server measures response time:** from `startsAt` to the answer's arrival, minus half the player's median round-trip time, capped at 150 ms. Clients never report times. In First correct, this adjusted time decides who was first, and arrival order breaks exact ties.
6. **The reveal is sent only after the round has closed for everyone.**
7. **A leak test** records every message sent before a reveal. It fails if any message contains the answer's titles, song, artists or IDs.

Wrong answers in the First correct mode cost points by default, so blind instant guessing loses points on average ([scoring](../product-specs/scoring.md)).

## Alternatives considered
- **Sending the answer to the client and checking it there:** rejected. A modified client reads it. Anagroove's co-op mode has this gap.
- **Trusting times reported by clients:** rejected, because a client can report any time it likes.
- **Hiding the answer by hashing it in the payload:** rejected. Four options give four candidates, so any hash can be matched in four tries.

## Consequences
- **Accepted risk:** a player can use a song-recognition app or ask someone. There are no accounts and no global leaderboard, so cheating only affects the cheater's own lobby. Speed scoring and short samples blunt it.
- Round-trip compensation is capped, so a slow connection loses a little time, and nobody gains time by faking latency.
- The leak test has to run whenever the protocol changes.
