# Changelog

All notable changes to **You Skipped The OP?!** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

## [0.7.0] - 2026-09-29

### Added
- The web client ([FRONTEND.md](docs/FRONTEND.md)), mobile first:
  - home: create a lobby, or join with a code or a join link and a name
  - lobby: the code, the join link and its QR code, the players with host, away and kick, the lock, the host's settings form (the scoring presets, modes and modifiers, songs, length, difficulty, years, genres, formats, sample start) or a summary for everyone else, and the number of matching songs and anime next to the start button
  - round: a countdown, then the four options exactly when the clip starts, keys 1 to 4, a timer and progress bar, who has answered, and a skip for the host
  - reveal: the anime in every language, OP or ED and its number, the song and its credited artists, when it aired, the cover, everyone's pick and points with icons and words, and the scores
  - results: the podium and each player's right answers, average time and best streak, with play again for the host
- The audio engine (`src/audio/engine.ts`): Web Audio with a gain node at 15% by default, unlocked by the Create or Join tap or a sound button, and started at the round's start on the server's clock, partway in when late. On iPhones it asks for media playback, so the silent switch doesn't mute it.
- The lobby socket client: hello with the seat from `sessionStorage`, clock sync with `time:ping`, reconnects with backoff, and an exit screen for kicks, closed lobbies and seats taken over by another tab.
- Device preferences in `localStorage` (`ysto_prefs`): volume, theme (Tokyo Rain, Sakura, Shonen as color palettes) and title language.
- A Vite dev proxy for `/api`, `/covers` and `/ws`, so `npm run dev` plays games.
- Tests: the client's reducer, clock, socket, store and audio engine against fakes, flows through `App`, and a browser test in which two players play a whole game against a generated catalog and tones.

### Changed
- The lobby state's `game` holds the final results once a game ends, so a player who reconnects sees them.
- The browser tests run against `e2e/fixture-server.ts`, which serves a generated catalog and tones instead of none.

## [0.6.0] - 2026-09-29

### Added
- The game loop ([GAME.md](server/game/GAME.md), [game flow](docs/product-specs/game-flow.md)):
  - a pure game engine, `step(game, event, now)`, and a shell that runs its effects: timers, clip cuts a round ahead, clip tokens, and messages
  - the round flow: `round:prepare` with the clip token, the ready barrier (8 s), `round:start` with the options (a 3 s countdown before the first round, 1 s before later ones), answers, `round:answered`, `round:reveal`, and `game:results` with the podium, correct answers, average time and best streak
  - answer times measured by the server, less half the median ping round trip (at most 150 ms). Early, late and repeated answers are dropped. In First correct the round closes 150 ms after the first correct answer.
  - host `game:start` (also for playing again, avoiding played themes) and `round:skip`. A skipped round scores nothing and breaks no streak.
  - late joiners watch and hear the rounds, then play from the next one. A reconnecting player gets the round in progress again.
  - a round whose clip fails on three themes is dropped, and a game ends when nobody is connected at a round's barrier
- The lobby state shows the game's phase and round, each player's score, and who is spectating.
- The reveal teaches the song's title and credited artists, which the catalog loader now reads, plus the cover served from `/covers/`.
- `/readyz` now also checks the audio folder and ffmpeg. `YSTO_AUDIO_DIR`, `YSTO_FFMPEG_PATH`, `YSTO_FFMPEG_CONCURRENCY` and `YSTO_MAX_GAMES` configure games.
- Tests: fake-clock games with 8 players in each scoring mode against the scoring table, the leak test, and whole games over real sockets.

### Changed
- Settings can't change while a game runs.
- Lobby seats no longer hold a score; the game's standings do.

## [0.5.0] - 2026-09-29

### Added
- Lobbies ([REALTIME.md](server/realtime/REALTIME.md), [GAME.md](server/game/GAME.md)):
  - `POST /api/lobbies` creates a lobby and `POST /api/lobbies/:code/players` joins one. Each returns a session token.
  - A WebSocket at `/ws` binds to a seat with `hello` and sends every player the lobby state after each change: players, host, lock, settings, pool size, and what the settings may choose from.
  - Players can leave. The host can kick, lock and change the settings. When the host leaves, or stays away past the 60 s grace, the player connected longest takes over.
  - A player who drops keeps the seat for 60 s. A lobby closes after 15 idle minutes, or after 4 hours.
- Limits per IP: lobby creations, joins, unknown codes, open lobbies and sockets. Per socket: message rate, frame size, and strikes for invalid messages.
- Security headers (CSP, nosniff, no referrer, a Permissions-Policy, noindex) on every response. Errors never show a stack trace.
- `shared/protocol.ts` with the messages, error and close codes, and one validator per message. Also `shared/names.ts` with the name rules, and a settings validator against the catalog's bounds.
- `/readyz`, JSON log lines at `LOG_LEVEL`, and a shutdown that tells players before closing their sockets.
- `LOG_LEVEL`, `YSTO_TRUST_PROXY`, `YSTO_ALLOWED_ORIGINS`, `YSTO_MAX_LOBBIES` and `YSTO_MAX_PLAYERS`.
- The clip route is now mounted with the lobby sessions.

### Changed
- The server starts without a catalog and reports itself not ready, instead of serving lobbies it can't fill.
- The custom popularity range starts at every rank when the catalog has fewer than 1,000 anime.
- Settings offer only genres with at least 50 playable themes, the threshold the catalog gate warns at.

---

Older releases are in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md).
