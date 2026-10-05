---
status: draft
last-verified: 2026-10-05
---

# Settings

## Goal
The host shapes the game (pool, length, difficulty, scoring). Each player sets what only affects them (volume, look, title languages).

## Behavior
| Setting | Scope | Range | Default |
| :-- | :-- | :-- | :-- |
| Sample length | Lobby (host) | 10–30 s, in 5 s steps | 20 s |
| Songs per game | Lobby | 5–50 | 15 |
| Years | Lobby | 1963–2026 (taken from the catalog) | all |
| Genres | Lobby | AniList genres with at least 50 playable themes, match any; empty means all | all |
| OP / ED | Lobby | OP, ED or both | both |
| Formats | Lobby | TV, TV Short, Movie, OVA, ONA, Special | all |
| Difficulty | Lobby | Easy, Normal, Hard, or a custom popularity rank range ([questions](questions.md)) | Normal |
| Sample start | Lobby | random, or intro | random |
| Scoring preset | Lobby | Classic, Buzzer, Chill ([scoring](scoring.md)) | Classic |
| Scoring mode | Lobby | Speed, First correct, Flat | Speed |
| Streak bonus, Comeback, Wrong-answer penalty | Lobby | on or off each | on, off, off |
| Answer changes | Lobby | on or off; ignored in First correct ([game flow](game-flow.md)) | off |
| Overtime | Lobby | 3–10 s, once everyone has answered, with answer changes on | 5 s |
| Volume | Player (device) | 0–100% | 15% |
| Theme | Player (device) | Tokyo Rain, Konbini 2 a.m., Karaoke Box, Hanami, Omikuji, Blossom Map, Fighter Select, Tournament Arc, Splash Page, Night Arc, Model Kit, Gachapon, Quest Board, Back Issue, Side A ([DESIGN.md](../DESIGN.md)) | Tokyo Rain |
| Title language | Player (device) | English, romaji, Japanese | English, falling back to romaji |
| Second title language | Player (device) | none, or one of the other two | none |
| Reduced motion | Player (device) | follows the OS setting, can be overridden | OS setting |

- While the host edits the settings, the lobby shows how many songs and anime match. An anime plays at most once per game, so the host can't start a game with fewer matching anime than the songs-per-game setting.
- A custom difficulty starts at popularity ranks 1–1,000 (every rank, when the catalog has fewer anime), where rank 1 is the most popular playable anime.
- Player settings are saved on the device (the `ysto_prefs` key in `localStorage`) and apply straight away. The Preferences button on every screen opens them, and the theme row opens the picker: a full-screen grid of every theme as its world's object in its own colors, where selecting one tries it on across the page, "Use this world" keeps it, Back or Escape keeps the theme the player had, and "Surprise me" lands on a random other world. A stored value that is missing or out of range falls back to its default, alone.
- Volume goes through a gain node, so the 15% default also applies on iPhones ([audio clips](../design-docs/audio-clips.md)).
- The interface is in English. Anime titles follow each player's title-language setting. A second language shows each option's title in it too, smaller, under the first; when both read the same ("Naruto" and "NARUTO"), the title shows once. Picking the second language as the first swaps the two. At the reveal the second language heads the anime's other titles.

## Acceptance criteria
- The server rejects settings outside these ranges, and genres outside the catalog's list.
- A new device plays at 15% volume in the Tokyo Rain theme with English titles.
- A player's settings survive a reload and never reach other players.
- Trying a world on in the picker never saves it; only "Use this world" does.

## Out of scope
- UI translations.
- Filters by demographic (Shounen, Shoujo, Seinen, Josei) or by players' AniList lists.
