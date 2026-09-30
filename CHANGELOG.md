# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.10.1] - 2026-09-30

### Fixed
- A crossover that AnimeThemes files under several series (Isekai Quartet, Kaginado) no longer merges those franchises into one, which Hard mode would have treated as a single franchise.

### Changed
- The catalog is built from a live AnimeThemes sync instead of the September dump: franchises now use AnimeThemes series, titles gain their synonyms, and reveals show cover art.

## [0.10.0] - 2026-09-30

### Added
- The right card lands with its stock's own hit at the reveal: a departure board flapping in the title (Tokyo Rain), a gold ring and a petal burst (Sakura), a red starburst and a shake (Shonen), lock brackets clamping on (Mecha), a foil ring and sparkles (Magical Girl), a flashing window and pixels (Isekai), a tracking glitch (Retro VHS). It lands harder on a streak of 3 and of 5.
- The results are announced from the bottom up, like a festival bill: the winner's name drops in last, its score counts up, and its theme's material bursts from it.
- The verdict lands like a stamp with a badge, and a streak chip shows from 2 right answers in a row.
- The face-down cards carry the game's "?!", slide in off the deck and idle with a passing light; locking in stamps the pick and gives a short buzz on phones.
- Each backdrop follows the game: more weather while the clip plays, and a flash at the reveal and the results (lightning, speed lines, hazard strips, a foil ring, static). Shonen's page turns speed lines while the clip plays, and Mecha's hangar blinks with beacons.
- "How to play" on the home screen, and the name's "?!" stamped on in the accent.
- A painted scene behind each theme's page, with no characters or text, kept faint enough that the page's text still passes AA contrast.

### Changed
- All four options turn face up together as the clip starts, in 180ms on a curve that shows the titles within about a frame, instead of appearing without a turn.
- The host's song pool and scoring rules fold under "Adjust the song pool and scoring rules"; the presets stay in view with a line on what the mode means.
- The lobby code is set in the theme's display face, and the lobby's start bar is solid.
- The results fill the screen, with Play again at their foot.
- The countdown's number is in the accent at full strength, and screen readers hear "Get ready" once rather than every second.
- A new screen (the lobby, a game, the results) moves the focus to its heading.

### Fixed
- The face-down cards before the clip never drew, in any theme.
- Players on the same score share a place at the reveal and in the results.
- Mecha's round heading no longer pushes "Skip round" onto a line of its own on a phone.

## [0.9.0] - 2026-09-30

### Added
- Seven anime themes, each printing the round's four options on its own card stock ([DESIGN.md](docs/DESIGN.md)):
  - Tokyo Rain: station name boards in the rain, lit amber when picked
  - Sakura: hanafuda with a double vermilion rim and a blossom, on a seigaiha page
  - Shonen: inked manga panels with screentone and one red spot color
  - Mecha (new): chamfered armor plates with a bevel, rivets, hazard strips and lock brackets
  - Magical Girl (new): gem cards rimmed in gold foil, with a faceted gem for the index
  - Isekai (new): JRPG menu windows with numbered slots and a blinking cursor
  - Retro VHS (new): tape labels with sunset stripes and on-screen-display type
- Each theme has its own display face and card title face, all OFL fonts from Fontsource in Latin subsets: Zen Kaku Gothic New, Zen Antique, Bangers, Saira Stencil One, Mochiy Pop One, Press Start 2P with Pixelify Sans, and VT323.
- The options lie face down until the clip starts, then show at once. At the reveal the right card turns over to its printed back.
- A listening panel above the cards shows whether this player's clip is loading, playing or failed to load, so "I can't hear it" never looks like "I don't know it".
- Buttons, fields, dropdowns, checkboxes and radios take each theme's stock.

### Changed
- The reveal puts this player's verdict and standing first, under the round's heading.
- The standings at the reveal and the final results are billed like a festival lineup, the leader's full name largest. The final results replace the podium and the table.
- A picked card gets a "Your pick" stamp on its edge, which never changes its size, and the other cards dim as a whole.
- On wider screens the cards are twice as tall and the equalizer spans the column.
- Japanese titles use the device's Japanese fonts instead of a display face's fallback.
- The new faces replace Tilt Neon, M PLUS Rounded 1c and Anton.
- The contrast test covers the card stock: text on cards, dimmed cards, chosen cards and card backs, and the index marks.

## [0.8.1] - 2026-09-30

### Added
- `PRODUCT.md`, the product record: who plays, what success means, what sets the game apart from other anime music quizzes, its constraints, what evidence exists (and what must never be invented), its principles and its accessibility commitments. The Impeccable design skill reads it, and AGENTS.md links it.

### Changed
- `docs/PRODUCT_SENSE.md` points to `PRODUCT.md` for who plays, instead of describing the players twice.
- The Impeccable skill's local settings folder, `.impeccable/`, is ignored by git and by the doc checks.

## [0.8.0] - 2026-09-29

### Added
- The three themes, each a block of CSS variables ([DESIGN.md](docs/DESIGN.md)):
  - Tokyo Rain: neon glows, falling rain, and Tilt Neon headings that glow and flicker
  - Sakura: soft blossom light, falling petals, round corners, and M PLUS Rounded 1c headings
  - Shonen: halftone dots, speed lines, square corners with an offset shadow, a burst behind each answer, and Anton headings in capitals
- A theme picker that shows each theme in its own colors and type, and the Preferences menu on the home screen too.
- A motion setting (as the device is set, reduced or full). Decoration only moves when motion is full, reduced motion also stops transitions, and the options never animate.
- The reveal's playful line: a wrong or missing answer earns "You skipped the OP?!" (or the ED).
- A favicon, and the browser's toolbar color follows the theme on phones.
- Tests: the themes' contrast against WCAG AA from `styles.css`, and axe on every screen in every theme in the browser tests.

### Changed
- Form fields have their own border color (`edge`), at 3:1 against the page and panels.
- The hint about keys 1 to 4 shows only where a mouse or trackpad suggests a keyboard.
- Each browser project in the browser tests sends its own client address, so the per-IP lobby limits count each browser on its own.
