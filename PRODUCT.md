---
status: verified
last-verified: 2026-10-05
---

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Groups of friends who watch anime. They play together in one room or over a voice call, on phones as often as on laptops, and each player uses their own device. A game lasts about 5 to 15 minutes, and a group plays several in a row in the same lobby. Players also play alone, to practice recognizing openings and endings.

The owner runs the game for their own friends. There is no public audience to court.

## Product Purpose
You Skipped The OP?! is a multiplayer anime music quiz in the browser. Each round plays a short sample of an anime opening or ending, and every player picks the anime from four options. A host creates a lobby and shapes the game (songs, sample length, the song pool, difficulty, scoring), and friends join with a code or a link and a name.

Success means three things:
- It is the friend group's default for game nights, in one room or over a voice call.
- It is a good way to practice alone.
- It shows craft: the design, the fairness and the polish are something the owner is proud to show.

## Positioning
Four things set it apart from other anime music quizzes, such as Anime Music Quiz:
- **No typing.** Four options per round, so phones play as well as laptops.
- **Private for friends.** A code or a link and a name: no accounts, no public lobby list, a low-profile site.
- **A new sample every play.** Each round cuts a fresh random part of the song, so replays never turn into memorization.
- **Fair, synced rounds.** Everyone hears the clip start together, the server times and scores every answer, and nothing a player receives before the reveal identifies the song.

## Operating Context
- Friends play on game nights, in the same room or on a voice call, each hearing the clip on their own device.
- The host shares the lobby's code, link or QR code, sets up the game and starts it. Later games run in the same lobby.
- The game runs on one small VPS for the owner's friends, from the owner's own library of AnimeThemes audio, which never leaves the server.
- The interface is in English. Anime titles show in each player's choice of English, romaji or Japanese.

## Capabilities and Constraints
- Lobbies hold up to 12 players. Games have 5 to 50 songs with samples of 10 to 30 s, and the host picks a scoring preset (Classic, Buzzer, Chill) or tunes the modes and modifiers ([product specs](docs/product-specs/index.md)).
- Each device has its own volume (15% at first), theme (Tokyo Rain, Konbini 2 a.m., Karaoke Box, Hanami, Omikuji, Blossom Map, Fighter Select, Tournament Arc, Splash Page, Night Arc, Model Kit, Gachapon, Quest Board, Back Issue, Side A), title languages (one, or two shown together) and motion setting.
- The server makes every decision that affects a score ([anti-cheat](docs/design-docs/anti-cheat.md)).
- The repo is public. Audio, catalog data, secrets and details of the owner's machine are never committed, and public text describes the audio library only in general terms, without counts or sizes.
- Metadata comes from AnimeThemes and AniList, under their terms. The running server calls no third-party service.
- The audio and artwork are copyrighted, so the site stays low-profile: short clips, no downloads, no search indexing, and credit to the sources.
- Hosting: a Hetzner Cloud VPS behind Caddy, on a domain the owner keeps in the VPS's `.env` (decided in M8 of the [v1 plan](docs/exec-plans/completed/2026-09-25-ysto-v1.md)).

## Brand Commitments
- The name, You Skipped The OP?!, sets the voice: playful and anime-literate, never mean. A missed song earns the line "You skipped the OP?!".
- Copy is short, plain English in sentence case, with no emoji, and no exclamation marks outside the name and that line.
- The themes evoke their genres with original shapes and open fonts, never official artwork, logos, character names or fonts from any series.
- What to favor where no spec says: [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md). How it looks: [docs/DESIGN.md](docs/DESIGN.md).

## Evidence on Hand
- There are no testimonials, player counts, press or usage data. Nothing of the kind may be invented.
- Real assets: the name, the favicon (`public/favicon.svg`), the fifteen themes (`src/styles.css`) and their backdrop plates (`src/assets/plates/`), and the credits to AnimeThemes and AniList.
- The owner's audio library is private. Public material never describes its size or contents.

## Product Principles
- Recognizing the song wins, not reading the options: no option may stand out by its title, popularity, language or franchise.
- Fairness over flashiness: the server decides everything, and every player sees the options at the same moment.
- Quick to join over features: a code or a link and a name, nothing more.
- Private and low-profile over growth: no public lobby list, no search indexing, no global leaderboard.
- The reveal teaches: the anime in all three languages, the song and its artists, OP or ED and its number, and when it aired.

## Accessibility & Inclusion
- Every theme meets WCAG AA contrast, and tests check it. Right and wrong answers show with an icon and words, never color alone.
- The game works with the keyboard alone, and screen readers get labeled controls.
- Audio is the quiz itself, so it has no text alternative. The reveal gives the answer in text.
- Motion is decoration. It follows the device's reduced-motion setting unless the player overrides it.
- Volume starts at 15% and can change at any time.
