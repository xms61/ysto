---
status: draft
last-verified: 2026-09-25
---

# Settings

## Goal
The host shapes the game (pool, length, difficulty, scoring). Each player sets what only affects them (volume, look, title language).

## Behavior
| Setting | Scope | Range | Default |
| :-- | :-- | :-- | :-- |
| Sample length | Lobby (host) | 10–30 s, in 5 s steps | 20 s |
| Songs per game | Lobby | 5–50 | 15 |
| Years | Lobby | 1963–2026 (taken from the catalog) | all |
| Genres | Lobby | AniList genres, match any; empty means all | all |
| OP / ED | Lobby | OP, ED or both | both |
| Formats | Lobby | TV, TV Short, Movie, OVA, ONA, Special | all |
| Difficulty | Lobby | Easy, Normal, Hard, or a custom popularity rank range ([questions](questions.md)) | Normal |
| Sample start | Lobby | random, or intro | random |
| Scoring preset | Lobby | Classic, Buzzer, Chill ([scoring](scoring.md)) | Classic |
| Scoring mode | Lobby | Speed, First correct, Flat | Speed |
| Streak bonus, Comeback, Wrong-answer penalty | Lobby | on or off each | on, off, off |
| Volume | Player (device) | 0–100% | 15% |
| Theme | Player (device) | Shonen, Sakura, Tokyo Rain ([DESIGN.md](../DESIGN.md)) | Tokyo Rain |
| Title language | Player (device) | English, romaji, Japanese | English, falling back to romaji |
| Reduced motion | Player (device) | follows the OS setting, can be overridden | OS setting |

- While the host edits the settings, the lobby shows how many songs match. The host can't start a game with fewer matching songs than the songs-per-game setting.
- Player settings are saved on the device (`ysto_*` keys in `localStorage`) and apply straight away.
- Volume goes through a gain node, so the 15% default also applies on iPhones ([audio clips](../design-docs/audio-clips.md)).
- The interface is in English. Anime titles follow each player's title-language setting.

## Acceptance criteria
- The server rejects settings outside these ranges, and genres outside the catalog's list.
- A new device plays at 15% volume in the Tokyo Rain theme with English titles.
- A player's settings survive a reload and never reach other players.

## Out of scope
- UI translations.
- Filters by demographic (Shounen, Shoujo, Seinen, Josei) or by players' AniList lists.
