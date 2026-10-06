---
status: draft
last-verified: 2026-10-06
---

# Questions and options

## Goal
Each round asks which anime a sample comes from. It has four plausible options and exactly one right answer, so recognizing the song decides the round, not guessing from how the options look.

## Behavior
**Options.**
- Four anime titles, exactly one of them right. The only text inputs in the app are the player name and the lobby code.
- Titles show in each player's title language: English, romaji or Japanese, and optionally a second one under it ([settings](settings.md)). The server sends the four titles in all three languages, and each device shows its player's choice.
  - If any of the four has no title in that language, all four show romaji for that round, so a fallback never singles one out. A missing romaji title falls back to the AnimeThemes name.
  - Two anime whose titles match in some language share a question only when their years differ. The year is then added to both titles in that language.
- The option order is random each round and the same for every player in the lobby.

**Distractors.**
- A distractor is never an anime credited with the same song, by song ID or by identity key ([catalog](../design-docs/catalog.md)).
- The options' franchises never point at the answer:
  - Easy and Normal take the four options from four different franchises.
  - Hard pairs the answer with another anime of its franchise, and adds two anime of one other franchise. Players have to know which season a song belongs to, and the two pairs look alike. When the lobby's anime hold no other anime of the answer's franchise, or no other franchise can supply a pair, Hard uses four franchises too.
- Distractors come from the anime that pass the lobby's year, genre and format filters, because players know the settings and could rule out an anime from outside them. Only when those anime run out do single distractors come from the rest of the catalog. Hard's pairs never do.
- Within those rules, distractors resemble the answer:

| Difficulty | Distractors |
| :-- | :-- |
| Easy | popularity within ±25 percentile points, same format family (series, movie, OVA) |
| Normal | popularity ±15, era ±8 years, same format family |
| Hard | popularity ±10, era ±3 years, at least one shared genre, same format family |

When too few candidates match, the rules relax step by step (a wider band and era, then any genre and format), first among the lobby's anime, then across the catalog. Custom uses Normal's distractors.

**Song selection.**
- The pool is every playable theme that passes the lobby's filters (OP or ED, years, genres, formats and difficulty) and is long enough for the sample. An anime without a year only passes when the year filter spans the whole catalog, and an anime of unknown format only when every format is selected.
- Songs are drawn in three steps (franchise, then anime, then theme) without replacement. That way long runners like Detective Conan, with 79 themes, don't crowd a game. An anime appears at most once per game, so the lobby counts the pool in anime as well as themes, and the anime count limits the songs per game.
- Themes the lobby has already played are skipped until fewer unplayed anime remain than the game needs.
- Each preset is a cut over the themes' difficulty scores: Easy is the easiest 20%, Normal the easiest 50%, and Hard is all of them. Custom sets an anime popularity rank range instead.
- The sample start is random on every play, uniform over `[3 s, duration − sample length − 5 s]`. Themes too short for that range are left out of the pool. The "intro" setting starts at 0 s, which suits easy lobbies.
- Adult anime (AniList `isAdult`) are never in the pool.
- **What the options name** (the lobby's Questions setting): the anime (the default), the song's title, its artists, or Mixed, which draws each round's kind at random from those its theme can answer. The round says which ("Pick the song's title.", "Pick who sings it."), and the clip and the reveal are as before. A song title or artist option reads the same in every title language, since a song has one title and one credit. Their wrong options are other themes' titles or credits from anime as popular as the answer's (searched in widening bands, the lobby's anime first, then the whole catalog), each from another franchise, never the answer's song, never the same title, and in artist rounds never a credit that shares an artist with another option, so a duet can't make two options right. A theme without a song title, or without artists, isn't in the pool for that kind, so the lobby's pool count follows the setting (`server/game/song-options.ts`).

## Acceptance criteria
Over 10,000 seeded questions per difficulty:
- Every question has exactly one correct option and four distinct titles in every language.
- No distractor has the answer's song, by song ID or by identity key.
- Every option passes the lobby's year, genre and format filters, while the lobby's anime can fill the question.
- On Easy and Normal, the options come from four franchises. On Hard, they come from two franchises, two each, whenever the lobby's anime include another of the answer's franchise, and from four franchises otherwise.
- The correct position is spread evenly over 0–3.
- Over 2,000 song title and 2,000 artist questions, on a catalog with shared titles, shared artists and duets: four distinct options, the right one the answer's own title or credit, four franchises, and no artist on two options.
- No anime appears twice in a game, and every sample offset is within bounds.

## Out of scope
- Questions about OP versus ED.
- Free-text answers.
