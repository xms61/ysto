---
status: draft
last-verified: 2026-10-06
---

# Settings

## Goal
The host shapes the game (pool, length, difficulty, scoring). Each player sets what only affects them (volume, look, title languages).

## Behavior
| Setting | Scope | Range | Default |
| :-- | :-- | :-- | :-- |
| Sample length | Lobby (host) | 10–30 s, in 5 s steps | 20 s |
| Songs per game | Lobby | 5–50; doesn't apply to an endless game | 15 |
| Play | Lobby | Classic; Elimination: a wrong or missed answer costs a life, and the last one standing wins; or Teams: players split into teams, each scoring its members' average ([game flow](game-flow.md)). Elimination can't use First correct | Classic |
| Lives | Lobby | 1–5, in Elimination | 3 |
| Questions | Lobby | Anime, Song title, Artist, or Mixed (a different one each round) ([questions](questions.md)) | Anime |
| Teams | Lobby | 2–4, in Teams | 2 |
| Endless | Lobby | on or off: rounds keep coming until the host ends the game, or the pool runs out ([game flow](game-flow.md)) | off |
| Hints | Lobby | on or off: from halfway through a round, a player can see when the anime aired, for 70% of the points ([game flow](game-flow.md)) | off |
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
| Sound effects | Player (device) | on or off | on |
| Theme | Player (device) | Neon Rain, Karaoke Box, Omikuji, Blossom Map, Fighter Select, Quest Board, Back Issue, Side A ([DESIGN.md](../DESIGN.md)) | Neon Rain |
| Title language | Player (device) | English, romaji, Japanese | English, falling back to romaji |
| Second title language | Player (device) | none, or one of the other two | none |
| Reduced motion | Player (device) | follows the OS setting, can be overridden | OS setting |

- While the host edits the settings, the lobby shows how many songs and anime match. An anime plays at most once per game, so the host can't start a game with fewer matching anime than the songs-per-game setting.
- **Saved setups:** under the settings, the host can save them under a name (up to 30 characters), up to eight setups on the device (`ysto_saved_settings`), newest first; saving under a name already used replaces it. Loading one fits it to this lobby: genres the catalog doesn't offer drop out, years and ranks narrow to the catalog's, a setting saved before it existed takes its default, and any other value the lobby can't take goes back to its default. The form then says what changed.
- A custom difficulty starts at popularity ranks 1–1,000 (every rank, when the catalog has fewer anime), where rank 1 is the most popular playable anime.
- Player settings are saved on the device (the `ysto_prefs` key in `localStorage`) and apply straight away. The Preferences button on every screen opens them, and the theme row opens the picker: a full-screen grid of every theme as its world's object in its own colors, where selecting one tries it on across the page, "Use this world" keeps it, Back or Escape keeps the theme the player had, and "Surprise me" lands on a random other world. A stored value that is missing or out of range falls back to its default, alone; a player whose saved world was retired (Hanami, Tournament Arc, Splash Page, Night Arc, Model Kit and Gachapon, in 1.17.0, and Konbini 2 a.m., merged into Neon Rain in 1.18.0) gets Neon Rain.
- **What's new:** the first time a device opens a newer version, a dialog lists what changed for players, in at most three short lines from `src/whats-new.ts`, with a "Got it" button (Escape or a tap outside closes it too). It shows on the home screen or in the lobby, never in a round or on the results. A device's first visit shows nothing and only notes the version (`ysto_seen_version`), and a version without a note shows nothing.
- Volume goes through a gain node, so the 15% default also applies on iPhones ([audio clips](../design-docs/audio-clips.md)).
- **Sound effects:** each world has its own short sounds (`src/audio/sounds.ts`): the deal as a round's cards come in, a pick when this player picks, the overtime's call when it starts, right or wrong as the right card lands at the reveal (a missed round sounds wrong, a skipped one plays nothing), and the results as the game ends. They are synthesized with Web Audio, play at 35% of the game's volume under the clip, and stay silent at volume 0, before the first tap unlocks audio, and with the switch off. Nothing plays for the state a page loads into.
- The interface is in English. Anime titles follow each player's title-language setting. A second language shows each option's title in it too, smaller, under the first; when both read the same ("Naruto" and "NARUTO"), the title shows once. Picking the second language as the first swaps the two. At the reveal the second language heads the anime's other titles.

## Acceptance criteria
- The server rejects settings outside these ranges, and genres outside the catalog's list.
- A new device plays at 15% volume in the Neon Rain theme with English titles.
- A player's settings survive a reload and never reach other players.
- With sound effects off or the volume at 0, the game makes no sound but the clip's.
- Trying a world on in the picker never saves it; only "Use this world" does.

## Out of scope
- UI translations.
- Filters by demographic (Shounen, Shoujo, Seinen, Josei) or by players' AniList lists.
