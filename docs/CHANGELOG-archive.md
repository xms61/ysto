# Changelog archive

Releases moved out of `CHANGELOG.md` (which keeps about the latest 5). Newest first.

## [0.10.1] - 2026-09-30

### Changed
- M6 is done: a whole game on a real iPhone played every clip, at the 15% default volume and with the silent switch on. The v1 plan and the audio clips doc record the check.

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
- Seven anime themes, each printing the round's four options on its own card stock ([DESIGN.md](DESIGN.md)):
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
- The three themes, each a block of CSS variables ([DESIGN.md](DESIGN.md)):
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
- The web client ([FRONTEND.md](FRONTEND.md)), mobile first:
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
- The game loop ([GAME.md](../server/game/GAME.md), [game flow](product-specs/game-flow.md)):
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
- Lobbies ([REALTIME.md](../server/realtime/REALTIME.md), [GAME.md](../server/game/GAME.md)):
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

Older releases are in [docs/CHANGELOG-archive.md](CHANGELOG-archive.md).

## [0.4.0] - 2026-09-29

### Added
- The clip service (`server/clips/`, [CLIPS.md](../server/clips/CLIPS.md)):
  - a cutter that re-encodes the chosen part of a song to a 128 kbps MP3 with short fades, no tags, and only from files inside `YSTO_AUDIO_DIR`
  - an ffmpeg runner with an argument array, a 10 s timeout and a concurrency limit
  - clip tokens that belong to one lobby and expire
  - `GET /api/clips/:token`, which needs the player's session token and answers every refusal with the same 404. Lobbies wire it up in M4.
  - `prepareClip`, which moves a round to another theme when its cut fails, up to three themes, and logs each failure once
- `replacementQuestion` in the question engine draws that other theme from an anime the game doesn't use yet.
- `npm run clips:bench` times clip cuts from the real library. A 30 s clip took about 0.3 s on the development machine.
- A browser decode test (`e2e/clip-decode.spec.ts`) checks that the cutter's MP3 decodes through Web Audio at its length. The browser tests now run in Firefox too.

### Changed
- Clips are MP3 rather than the planned AAC: faster to encode, no container tags, and decodable without proprietary codecs.
- The e2e tests have their own TypeScript project with DOM types (`tsconfig.e2e.json`), which `npm run typecheck` includes.
- The hosting doc puts the library export at about half the original size, as measured, instead of 40%.

## [0.3.0] - 2026-09-25

### Added
- The question engine (`server/game/`, [GAME.md](../server/game/GAME.md)), which turns lobby settings into a game:
  - songs drawn by franchise, then anime, then theme, with no anime twice in a game, and themes the lobby has played skipped while enough others remain
  - a random sample start that keeps clear of the first 3 s and the last 5 s, or 0 s with the intro setting
  - three distractors that never share the answer's song, resemble the answer in popularity, era, genre and format, and never form a franchise pattern that points at the answer
  - option titles in English, romaji and Japanese, with romaji for all four when one title is missing, and years added to titles that match
- `server/catalog/load.ts` loads `catalog.sqlite` into memory, and refuses a catalog of another schema version.
- `shared/settings.ts` holds the lobby settings, their limits and defaults. `shared/scoring.ts` holds the Speed, First correct and Flat modes, the streak, comeback and penalty modifiers, the Classic, Buzzer and Chill presets, and the final ranking.
- Property tests build 10,000 seeded questions per difficulty on a synthetic catalog shaped like the real one. A table of cases covers the scoring.

### Changed
- Hard now pairs the answer with one other anime of its franchise and adds a pair from one other franchise, instead of filling the options from the answer's franchise first. Easy and Normal take their four options from four franchises. Distractors stay within the lobby's filters while its anime can fill them.
- `catalog:check` samples files with the game's seeded generator.

## [0.2.1] - 2026-09-25

### Changed
- Covers come from AnimeThemes' own images, not AniList. The sync asks for `images`, and `catalog:covers` downloads the large cover (or else the small one), named after the AnimeThemes anime id. With a dump, which has no cover links, the step explains that and stops.
- The AniList query no longer asks for cover images: only the fields the game uses, in line with AniList's terms.
- The plan records the owner's decisions on AniList use and covers (Q16).

## [0.2.0] - 2026-09-25

### Added
- The catalog build (`scripts/catalog/`), one command per step:
  - `catalog:sync-animethemes`: AnimeThemes metadata from the API, or `--from-dump`
  - `catalog:scan-audio`: durations with ffprobe
  - `catalog:enrich-anilist`: titles, genres, popularity, the adult flag and relations, fetched in paced batches
  - `catalog:covers`: optional, and on hold until the cover source is decided
  - `catalog:build`: writes `catalog.sqlite` and prints a review report
  - `catalog:check`: the gate for matching, popularity, the adult filter and loudness
- Every step caches its work and resumes after an interruption. The assembly is a pure function, so the same inputs give the same catalog.
- The catalog schema in `server/catalog/schema.ts`, and the generated `docs/generated/catalog-schema.md`.
- `YSTO_AUDIO_DIR`, `YSTO_CATALOG_DIR`, `YSTO_CACHE_DIR` and `YSTO_FFMPEG_PATH`, read by `loadCatalogConfig` in `server/config.ts`.
- Tests for every step: a fake HTTP client instead of the network, and ffmpeg-generated tones instead of the library.
- The area doc `scripts/catalog/CATALOG.md`, and a README section on building the catalog.

### Changed
- ESLint allows `node:sqlite` only in `server/catalog/` and `scripts/catalog/`, and `process.env` only in `server/config.ts`, now also for the scripts.
- Coverage includes `scripts/catalog/`, and the CI `app` job installs ffmpeg for the audio tests.
- The catalog design doc describes the build as implemented, including the gate's thresholds. SECURITY.md records AniList's and AnimeThemes' terms.

## [0.1.4] - 2026-09-25

### Added
- `LICENSE`: Apache License 2.0, also set in `package.json`, with a License section in the README.
- A "Before a release" step in the release process: the doc-gardening pass.

### Changed
- Doc gardening runs before each release, not weekly.
- The release process and SECURITY.md say that new high or critical CodeQL alerts block merges to `main`.
- The v1 plan records M0 as done, with the owner's answers on license, merging and gardening.

## [0.1.3] - 2026-09-25

### Added
- Design docs: system design, anti-cheat and score integrity, catalog, audio clips and playback, hosting and deploy.
- Product specs: game flow, questions and options, scoring, lobby, settings.
- A documentation and credits section in the README.

### Changed
- SECURITY, RELIABILITY, PRODUCT_SENSE and DESIGN are now drafts, no longer stubs.
- The v1 plan links to the docs that own each part of the design, and keeps only the milestones, progress and decisions.
- The README no longer has the template's setup section.

## [0.1.2] - 2026-09-25

### Added
- App scaffold:
  - an Express 5 server (`server/`) with `/healthz`, which serves the built client and falls back to it for client-side routes such as join links
  - a React 19 client built by Vite 8, with Tailwind CSS 4 (`src/`)
- Tooling:
  - TypeScript 6.0, with separate configs for the client and for Node
  - ESLint 10, with the layer rules and a single reader of env vars, plus Prettier
  - Node's test runner with coverage thresholds, Vitest with Testing Library, and a Playwright smoke test in Chromium and WebKit
- CI jobs `app` (`npm run test:ci` and the build) and `e2e` (the smoke test), and Dependabot for npm.

### Changed
- Prettier formats the doc and tracked-files scripts.

## [0.1.1] - 2026-09-25

### Added
- `scripts/check-tracked-files.mjs`, with tests, keeps the public repo clean. It blocks media, databases, metadata dumps, env files, keys and files over 1 MiB. It also blocks text that reveals this machine: home-folder paths and the local user or host name. A pre-commit hook in `.githooks/` runs it on staged files.
- gitleaks in CI, pinned by version and checksum, with an extra rule for home-folder paths (`.gitleaks.toml`).
- An allowlist `.dockerignore`, so new data folders stay out of images.
- Dependabot updates for the SHA-pinned actions.

### Changed
- CI runs on every pull request and every push to `main`, and its actions are pinned by commit SHA.
- `.gitignore` also covers audio and video files, metadata dumps and more key formats.

## [0.1.0] - 2026-09-25

### Added
- Repository setup: agent doc map (`AGENTS.md`), code style, testing and release docs, CI.
- Knowledge base: `ARCHITECTURE.md`, design docs, product specs, exec plans, topic docs, and `scripts/check-docs.mjs`, which CI runs to enforce links, frontmatter, indexes and plan sections.
