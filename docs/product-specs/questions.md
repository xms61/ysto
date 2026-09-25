---
status: draft
last-verified: 2026-09-25
---

# Questions and options

## Goal
Each round asks which anime a sample comes from. It has four plausible options and exactly one right answer, so recognizing the song decides the round, not guessing from how the options look.

## Behavior
**Options.**
- Four anime titles, exactly one of them right. The only text inputs in the app are the player name and the lobby code.
- Titles show in each player's title language: English, romaji or Japanese.
  - If any of the four has no title in that language, all four show romaji for that round, so a fallback never singles one out.
  - If two options have the same title, the year is added to both.
- The option order is random each round and the same for every player in the lobby.

**Distractors.**
- A distractor is never an anime credited with the same song ([catalog](../design-docs/catalog.md)).
- Easy and Normal never use the answer's franchise. Their distractors come from the answer's popularity band, so the one famous title isn't a giveaway. They also match its format family (series, movie, OVA) when the pool allows.
- Hard fills the distractors from the answer's franchise first (other seasons, movies, spin-offs), so players have to know which season a song belongs to. The tight Hard match fills the rest.

| Difficulty | Distractors |
| :-- | :-- |
| Easy | other franchises, popularity band ±25 percentile points |
| Normal | other franchises, band ±15, era ±8 years |
| Hard | the answer's franchise first, then band ±10, era ±3 years, at least one shared genre |

If fewer than three candidates match, the band widens step by step.

**Song selection.**
- Songs are drawn in three steps (franchise, then anime, then theme) without replacement. That way long runners like Detective Conan, with 79 themes, don't crowd a game. An anime appears at most once per game.
- Each preset is a cut over the themes' difficulty scores: Easy is the easiest 20%, Normal the easiest 50%, and Hard is all of them. Custom sets an anime popularity rank range and uses Normal's distractors.
- The sample start is random on every play, uniform over `[3 s, duration − sample length − 5 s]`. Themes too short for that range are skipped for the game. The "intro" setting starts at 0 s, which suits easy lobbies.
- Adult anime (AniList `isAdult`) are never in the pool.

## Acceptance criteria
Over 10,000 seeded questions per difficulty:
- Every question has exactly one correct option and four distinct titles.
- No distractor has the answer's song, by song ID or by identity key.
- On Easy and Normal, no distractor comes from the answer's franchise. On Hard, the answer's franchise fills the distractors first when it has other anime.
- The correct position is spread evenly over 0–3.
- No anime appears twice in a game, and every sample offset is within bounds.

## Out of scope
- Questions about the song title, the artist, or OP versus ED.
- Free-text answers.
