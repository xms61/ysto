---
status: draft
last-verified: 2026-09-25
---

# Scoring

## Goal
Hosts tune how the game feels: a race, a buzzer, or a calm quiz. Whatever they choose, scores stay fair, and blind guessing doesn't pay.

## Behavior
The host sets the scoring in the lobby, and presets bundle common combinations. The rules live in one pure module, `shared/scoring.ts`. Only the server runs it; clients display the results.

| Mode | A correct answer scores | The round ends |
| :-- | :-- | :-- |
| Speed (default) | `round(1000 × (1 − 0.5 × t / T))`: 500–1,000 points, where `t` is the response time and `T` the answer window | at the deadline, or when everyone has answered |
| First correct | 1,000 for the first correct answer, 0 for later ones | at the first correct answer, or at the deadline |
| Flat | 1,000 | as in Speed |

| Modifier | Effect | Default |
| :-- | :-- | :-- |
| Streak bonus | +100 for each correct answer in a row after the first, up to +500 | on |
| Comeback | while a player is behind the leader, their streak bonus is doubled | off |
| Wrong-answer penalty | −250, or −500 in First correct | off; on in First correct |

- There are three presets:
  - Classic: Speed with the streak bonus
  - Buzzer: First correct with the penalty, without the streak bonus
  - Chill: Flat, with no modifiers

  The host can change any setting after picking one.
- Without a penalty, instant blind guessing would win about a quarter of the rounds in First correct. The −500 penalty makes that strategy lose points on average (0.25 × 1,000 − 0.75 × 500 = −125).
- A wrong answer or no answer ends the streak. No answer never costs points, even with the penalty on. With the penalty, a total can drop below zero.
- The streak bonus only adds to points a correct answer earned, so in First correct only the winner gets it. Comeback compares the scores from before the round.
- In First correct, the fastest correct answer wins, and an exact tie goes to the answer that arrived first.
- Each player locks in one answer per round. Ties in the final ranking go to the player with less total response time on correct answers.
- Response times are measured by the server ([anti-cheat](../design-docs/anti-cheat.md)).

## Acceptance criteria
- A table of cases covers every mode and modifier, and `shared/scoring.ts` passes it.
- A fake-clock game with 8 players in each mode gives the scores the table predicts.
- In First correct, only the first correct answer scores, and the round ends there.

## Out of scope
- Jokers such as 50:50.
- Global or persistent leaderboards. Scores last as long as the lobby does.
- The final numbers and the comeback factor, which the M9 playtest tunes.
