# Changelog archive

Releases moved out of `CHANGELOG.md` (which keeps about the latest 5). Newest first.

## [1.5.0] - 2026-10-05

### Added
- What's new: the first time a device opens a newer version, a small dialog says what changed for players in up to three lines, on the home screen or in the lobby. The notes live in `src/whats-new.ts`, written for players; a first visit shows nothing.

## [1.4.0] - 2026-10-05

### Added
- The results list the game's songs, folded away below the standings: each round's anime in the player's title languages, OP or ED, the song and its artists, when it aired, and a link to the anime on AnimeThemes.
- The features plan gains M15, a short "What's new" dialog on a player's first visit after an update.

## [1.3.0] - 2026-10-05

### Added
- A page from an older version reloads itself after a deploy, in the lobby or on the results but never during a round, and keeps its seat. Before, an old tab's settings were refused by the new server.

## [1.2.1] - 2026-10-05

### Added
- An exec plan for the features after 1.0: the game's songs at the results, clip reports, the lobby's tally, reactions, saved settings, sound effects per world, hints, elimination, teams, song title and artist rounds, typed answers, a daily challenge with a streak, and party mode.

## [1.2.0] - 2026-10-05

### Added
- Answer changes: a lobby setting, off by default, lets players pick another option until the round closes. Once everyone has answered, an overtime of 3 to 10 s (the host picks, 5 s by default) gives a last chance to switch before the reveal: "Overtime" is called above the time left, and each world's timer counts it down. The others see who switched, never to what. A switch scores from the moment it is made, and First correct keeps the first answer as before.

## [1.1.0] - 2026-10-05

### Added
- A second title language: Preferences can show each option's title in a second language under the first, smaller (English with romaji, or English with Japanese, for example). A title that reads the same in both shows once, and the reveal lists the anime's other titles with the second language first.

### Changed
- The reveal no longer repeats a title that differs only in case, such as "Naruto" and "NARUTO".
- Older entries moved to the changelog archive.

## [1.0.0] - 2026-10-05

### Changed
- 1.0: the v1 plan is complete. The game runs on its VPS from the released image; the load test meets its targets and the security review has no high findings. The playtest with friends, the clip timing on the VPS and an external port scan follow (tech-debt tracker).
- The docs describe the running deployment: DEPLOY.md lists the open checks, SECURITY.md records the review, and the README's status is 1.0.

## [0.33.0] - 2026-10-05

### Added
- A load test, `npm run load`: 25 lobbies of 8 bots play whole games against a running server and check the targets in RELIABILITY.md (clips and event-loop lag at the 95th percentile). Three runs passed: every game finished, clips at p95 under 120 ms and ping round trips under 10 ms.

### Fixed
- A round that not everyone answered could stay open for good: Node can run a timer a millisecond before the clock reaches its time, the round's close was then ignored, and nothing tried again. Timers now wait out the rest.

## [0.32.0] - 2026-10-05

### Changed
- The catalog's AnimeThemes sync reads AnimeThemes' GraphQL API in place of its deprecated JSON:API. Pages are cached in the same shape as before and dumps still import, so builds don't change: three pages synced both ways parsed to the same 300 anime.
- Every opaque color in the themes is a named token in its theme block, including the backdrop's petals, twinkles and rain.

### Removed
- The shared timer bar. Every theme draws its own timer, and a new theme must name one.

## [0.31.1] - 2026-10-05

### Fixed
- The "you" and "host" chips and the shared timer bar take each theme's corners, so they are square in the square worlds instead of always round.

## [0.31.0] - 2026-10-05

### Added
- Side A is its own world: a friend's mixtape. The round's heading is written on the cassette's label; the time left is the cassette, its tape winding from one reel to the other; the options are four tracks handwritten in ballpoint down the lined insert, numbered A1 to A4 in the margin. A pick circles its number; at the reveal a highlighter stroke goes over the right track. The answer box is the insert's flap, the pickers' names little tape labels, and the winner's name is highlighted. Type is Caveat Brush and Caveat. With it, all fifteen themes are their own worlds.

### Changed
- Side A's insert is white with blue rules and its tracks stand in one column, in place of blue cards in a grid.

## [0.30.0] - 2026-10-05

### Added
- Night Arc is its own world: the all-black pages of a manga's darkest chapter. The round's heading is the chapter's header in white brush capitals; the time left is white focus lines closing in; the options are four black panels in white frames, their titles in white-ink balloons and their numbers in the gutters. A pick doubles its panel's frame; at the reveal the right panel bursts to white. Red is kept for a wrong verdict. Type is Shojumaru and Patrick Hand SC.

### Changed
- Night Arc's pick keeps its panel black with a doubled frame, so only the right answer turns white.

## [0.29.0] - 2026-10-05

### Added
- Splash Page is its own world: a battle manga page. The round's heading is a narration box; the time left is a panel's focus lines closing in on its center; the options are four slanted manga panels on screentone, read right to left, each title in a speech balloon. A pick blacks its panel out; at the reveal the right panel bursts into a splash of focus lines with a sound effect lettered over its corner. The answer box is another framed panel, the pickers' names little speech balloons, and the winner gets the splash. Type is Reggae One and Comic Neue.

### Changed
- Splash Page's type: Reggae One and Comic Neue, in place of Fighter Select's Bangers.

## [0.28.0] - 2026-10-05

### Added
- Tournament Arc is its own world: a semifinal bracket on the tournament board. The round's heading is a black banner brushed ragged at its ends; the time left is the referee's strip of red and white pennants, taken down one by one; the options are four hinoki entrant plates, each row a semifinal joined by a VS medallion on the bracket's spine, with the final's emblem at its center. A pick turns the plate black and advances it toward the spine; at the reveal the final lights gold and the right entrant takes it. The answer box is the board's result notice, the pickers' names little wooden plates, and the champion's gold plate hangs from its cord. Type is Dela Gothic One and Kaisei Tokumin.

### Changed
- Tournament Arc's type: Dela Gothic One and Kaisei Tokumin, in place of Fighter Select's Bangers.

## [0.27.0] - 2026-10-05

### Added
- Blossom Map is its own world: a hanami park's guide map. The round's heading is the map's green title cartouche with a north arrow; the time left is a walk along a dotted route to a blossom tree, the player's pin walking it; the options are four viewing spots, white capsules at their own places over the map's lawns, pond and paths. A pick sends this player's chip across to the capsule's leading edge; at the reveal the right spot blooms pink with a flower. The answer box is the map's legend, the pickers' names round map chips, and the winner is the spot in bloom. Type is Zen Maru Gothic.

### Changed
- Blossom Map's right answer blooms in blossom pink, in place of a solid green back.
- The browser tests run Chromium and Firefox muted.

## [0.26.0] - 2026-10-05

### Added
- Omikuji is its own world: a shrine's fortune slips in spring. The round's heading hangs on a torii's vermilion beam; the time left is a straw rope's paper streamers, taken one by one; the options are four folded slips with brushed vermilion numerals. A pick draws its slip; at the reveal the right slip unfolds as the great blessing and the others are tied to the branch with a paper knot. The answer box is the unfolded fortune, the pickers' names little paper slips, and the winner holds the great blessing. Type is Yuji Syuku, a brush face, and Shippori Mincho.

### Changed
- Omikuji's right answer unfolds on washi framed in vermilion, in place of a solid vermilion back.

## [0.25.0] - 2026-10-05

### Added
- Karaoke Box is its own world: the booth's lyric screen and song remote. The round's heading is a lyric line on the screen, "Round 1 of 5" in white with a periwinkle outline, filling with pink from the left as the time runs; the options are four song rows on the remote, in one column, each keyed by its song number. A pick lights its row pink; at the reveal the right row wipes to "now playing" in cyan. The answer box is the lyric screen, the pickers' names the remote's keys, and the results the end-of-song score screen with the winner's score huge in pink. Type is M PLUS Rounded 1c.
- A theme can stand its four options in one column of rows instead of 2x2.

### Changed
- Karaoke Box's song rows are pale with dark titles, in place of navy cards.

## [0.24.0] - 2026-10-05

### Added
- Konbini 2 a.m. is its own world: the one bright shop on a wet street. The round's heading is the shop's lit fascia sign over its two-color stripe; the time left reads on the register's teal display; the options are four marker-lettered price cards on a bright shelf, keyed by saffron price stars. A pick turns its star plum; at the reveal the scanner's red line passes down the right card as it prints a thermal receipt, and the others take a red "Sold out" label. The answer box is the receipt, the pickers' names are price-gun labels, and the results are the night's last receipt with the standings as line items. Type is DotGothic16 for the receipts and headings and Yusei Magic for the price cards.

### Changed
- Konbini 2 a.m.'s colors: saffron and plum from its shop stripe, in place of orange and teal.

## [0.23.0] - 2026-10-05

### Added
- The theme picker is its own full-screen sheet, "Choose a world": all fifteen themes in a grid, each tile its world's object as an icon in the world's colors (a capsule machine for Gachapon, a sword for Quest Board), with its name in its own type. Selecting a tile tries the world on across the whole page; "Use this world" keeps it, and Back or Escape puts the old one back. "Surprise me" spins a highlight across the grid and lands on a random other world.

### Changed
- Preferences shows the current theme as one row that opens the picker, in place of the list of fifteen.

## [0.22.0] - 2026-10-05

### Added
- Back Issue is its own world, and a light one: an eighties monthly anime magazine. The round's heading is the issue's masthead, "No. 03 / 15" at monumental size; the time left is a printer's ruler; the options are four feature boxes on one process-yellow slab, each with a reader's ballot square, printed a little off register. A pick marks its ballot with an X; at the reveal the other boxes are screened back under halftone and the right one turns to the answer page in process cyan; the answer box is the article page and the pickers' names are caption tags; the results are the readers' poll. Magenta is kept for what can be tapped. Type is Anton and Archivo Narrow.

### Removed
- Back Issue's tape: the VT323 font, the sunset stripes, the scanlines, the tracking band behind it, the title flicker and the reveal's glitch. Side A keeps its tracking band.

## [0.21.3] - 2026-10-05

### Changed
- Quest Board's type fits the guild: carved Cinzel capitals for the headings, scores and stamps, and IM Fell English, an old printer's face, for the notice titles, in place of the JRPG menu's pixel fonts. The "Completed" seal's lettering is set small enough to sit inside its ring.
- Model Kit's type is a kit manual's: Barlow Condensed in bold capitals for the headings and semibold capitals for the part titles, in place of the hangar's stencil and the system sans, so long titles fit their parts.

### Removed
- The Press Start 2P, Pixelify Sans and Saira Stencil One fonts, no longer used by any theme.

## [0.21.2] - 2026-10-05

### Changed
- Quest Board's bounty notices carry the owner's monster sketches, a slime, a tusked beast, a wyvern and a stone golem, in faint sepia ink behind each title, in place of the simple line drawings.

## [0.21.1] - 2026-10-05

### Changed
- The answer box below the cards and the names of who picked each option take each rebuilt world's material: Tokyo Rain's lit display panel and ticket stubs, Hanami's lacquer box and rice-paper slips, Fighter Select's profile panel and slanted name plates, Model Kit's manual page and gate tags, Gachapon's open capsule and little capsules.

## [0.21.0] - 2026-10-05

### Added
- Quest Board is its own world: the adventurers' guild notice board at night. The round's heading is carved into a plank; the options are four bounty notices pinned to the board, each with a ruled frame, a red heading and lines in a made-up script, a monster drawn faintly behind the title, and a red rank stamp for its key; the time left is a candle burning down. A pick is taken down to the counter in candlelight; at the reveal the right notice gets a big round "Completed" seal; the answer box below the cards is one more pinned bounty, and the pickers' names sit on paper slips; the winner's notice is pinned up at the results. With motion on, the flame flickers, a picked notice lifts and the seal thunks on.
- Image prompts for Quest Board's monster sprites, which will replace the line drawings.

### Removed
- Quest Board's pixel stars and blinking menu cursor.

## [0.20.0] - 2026-10-05

### Added
- Gachapon is its own world, and a light one: a capsule toy machine on a sunny shopping street. The round's heading is the machine's red head under a row of bulbs; the options are four alike capsules in the clear dome, each title on a paper slip; the time left is the coin dial turning. A pick drops its capsule toward the tray; at the reveal the others drop out in grey and the right capsule opens on a gold charm; the results bring the winner out in an open capsule. With motion on, the dial turns smoothly, the capsules drop and open, and the standings tumble out one at a time.

### Removed
- Gachapon's twinkling night stars; its sunny street keeps still.

## [0.19.1] - 2026-10-05

### Changed
- Hanami's dango skewer runs the width of the row, with nine dumplings, like Model Kit's runner.

## [0.19.0] - 2026-10-05

### Added
- Model Kit is its own world: a step of a plastic model kit's manual on the cutting mat. The round's heading is the step header on the manual's paper; the options are four armor parts on one grey runner, keyed by gate tags A1 to A4; the time left is a nipper cutting along the runner's frame. At the reveal the right part is cut free in yellow plastic and snaps into place, and the rest stay on the runner as spares. With motion on, the nipper's jaws snap at each cut and the right part lifts and snaps down.

### Removed
- The hangar's scanner sweep and status beacons behind the old Mecha theme; Model Kit's workbench keeps still.

## [0.18.4] - 2026-10-05

### Changed
- Tokyo Rain's noren is cloth: it hangs from a wooden pole across the machine's top, and below the heading its hem splits into four panels with the cabinet between them, printed with a white band and a crest the middle slit cuts in two, ending a little unevenly. With motion on, the hem sways slowly while the clip plays.

## [0.18.3] - 2026-10-05

### Fixed
- The lobby's start bar stands on the screen's foot: at the end of the scroll it rose with the page's bottom padding and the backdrop showed under it. It also pads its foot clear of a phone's home bar.

### Changed
- Tokyo Rain, Hanami and Fighter Select print the start bar on their own material: the ticket machine's steel foot, the bento's lacquer lid edge rimmed in vermilion, and the arcade's control deck with its red slant.

## [0.18.2] - 2026-10-05

### Fixed
- The listening rings start on the headphones at round start: they followed the headphones only when the whole round panel resized, so when the countdown gave way to a world's timer, or a web font landed, they kept their old center. A browser test plays a game on a phone across five worlds and checks the center in every phase.

## [0.18.1] - 2026-10-01

### Changed
- The theme worlds plan says where to pick up: the three open review findings in order, with the causes found so far, and notes for checking a world locally.

## [0.18.0] - 2026-10-02

### Added
- The rebuilt worlds move in their own way, with motion on: Tokyo Rain's ticket feeds out of the machine line by line and its "Sold out" lamps flicker on; Hanami's dumplings pop off the skewer as they are eaten and the lids slide down over the other compartments; Fighter Select's chosen slot flashes as the select is confirmed, its digits tick each second, and the health bars fill as each player is billed.

### Changed
- Tokyo Rain's whole round panel is the ticket machine: a steel cabinet with the noren over its top, the listening light as a speaker grille, a recessed button bank, and a ticket outlet and coin slot along its foot.

## [0.17.0] - 2026-10-02

### Changed
- Fighter Select (the theme stored as Shonen) is an arcade character select: a black screen, the round on a red slanted banner, the seconds as two huge yellow digits that turn red in the last five, and the options as fighter slots with slanted name plates. A pick takes the red player cursor; at the reveal the right slot turns gold behind a starburst and the round's panel inverts for one frame. The results draw each score as a health bar against the winner's.

### Fixed
- A screen's heading no longer shows the browser's focus ring after it takes the focus for screen readers.

## [0.16.0] - 2026-10-02

### Changed
- Hanami (the theme stored as Sakura) is a lacquer bento opened on the blue picnic tarp: the page is the tarp, panels are black lacquer with a vermilion rim, and the options are the box's four rice-paper compartments split by green leaf dividers. The time left is a dango skewer eaten one dumpling at a time. A pick lifts its compartment while the others' lids close; at the reveal the right one turns to its vermilion seal.

## [0.15.0] - 2026-10-01

### Added
- The reveal shows who picked each option, as name chips under its card, yours in the theme's accent. Picks arrive only with the reveal, once the round has closed for everyone.
- Themes can lay out their own world in the round (`src/themes/stage.ts`): how the time left reads, and a mark on the options that were not the answer.

### Changed
- Tokyo Rain is a ramen ticket machine under the noren: the round's heading on an indigo noren, the seconds on an amber LED, the options as backlit buttons keyed by coin lamps. A pick lights its button; at the reveal the right one prints a ticket and the rest light "Sold out". The final standings hang from an order rail.

### Removed
- Tokyo Rain's departure-board letter flap at the reveal, with the station boards it belonged to.
## [0.14.1] - 2026-10-01

### Changed
- CI installs ffmpeg from Ubuntu packages kept in the Actions cache, downloaded once per runner image, instead of fetching them from the mirror in every job, where they took up to 15 minutes.
- The e2e job keeps Playwright's browsers in the Actions cache per Playwright version, and on a hit installs only their system libraries.

## [0.14.0] - 2026-10-01

### Added
- Eight new themes: Konbini 2 a.m., Karaoke Box, Omikuji, Blossom Map, Tournament Arc, Splash Page, Night Arc and Side A. For now they print the shared card layout in their own colors and faces; each gets its own round, reveal and results in a later release.
- A new backdrop plate for every theme, from the prompts in docs/PLATE_PROMPTS.md.

### Changed
- Six themes take the names of the worlds they are becoming: Sakura is Hanami, Shonen is Fighter Select, Mecha is Model Kit, Magical Girl is Gachapon, Isekai is Quest Board and Retro VHS is Back Issue. Saved settings keep working, since the ids are unchanged.

## [0.13.0] - 2026-09-30

### Changed
- The listening panel is a sonar instead of an equalizer: over-ear headphones in a ring, gray while the clip loads and lit in the theme's accent when ready. While the clip plays, rings leave the headphones every 1.4s and sweep the whole round panel behind the cards, and "Listen." is read to screen readers only.
- The reveal prints the answer on a band: the cover sharp over a blurred wash of itself, the title large beside it and stepping down in size for long titles, then the theme's kind and number on an accent chip with the song, artists and season.
- The reveal's standings are a scoreboard: an arrow for each player who moved up or fell back this round, the round's points with a check or a cross, and the total in the display face.
- The winner on the results screen is printed on the theme's card back, with each theme's own ornament.

## [0.12.1] - 2026-09-30

### Changed
- The v1 plan and DEPLOY.md record that the covers are converted to WebP and the catalog is rebuilt from the live AnimeThemes API, ready for the first upload.

## [0.12.0] - 2026-09-30

### Changed
- Covers are stored as WebP, at most 600 px wide and never enlarged. `npm run catalog:covers` converts the covers already on disk once, then downloads new ones in the same format; `npm run catalog:build` afterwards records the new file names. A sample shrank to about 29 % of its size, most covers at full resolution.
- Browsers keep covers for a day, so a cover that comes back in a game isn't fetched again.

## [0.11.1] - 2026-09-30

### Fixed
- A crossover that AnimeThemes files under several series (Isekai Quartet, Kaginado) no longer merges those franchises into one, which Hard mode would have treated as a single franchise.

### Changed
- The catalog is built from a live AnimeThemes sync instead of the September dump: franchises now use AnimeThemes series, titles gain their synonyms, and reveals show cover art.

## [0.11.0] - 2026-09-30

### Added
- A Docker image: Node 24 on Alpine with ffmpeg, run as a non-root user with a health check, and without npm, corepack or yarn.
- `deploy/`: the VPS's compose file, with Caddy serving HTTPS on the domain in `YSTO_DOMAIN` and the game hardened behind it (read-only, no capabilities, no published port), a Caddyfile, and a `.env.example`.
- `npm run catalog:export`: re-encodes every file the catalog plays to 128 kbps Opus in `YSTO_EXPORT_DIR` for the VPS. Reruns encode only new or changed files and remove copies no longer played.
- The release workflow, started by hand from main: reruns CI, publishes the image for amd64 and arm64 to GHCR with an SBOM and provenance, tags the version and creates the GitHub release.
- A `docker` CI job: builds the image, runs it on the fixture catalog until it is ready, cuts clips in it, checks that it holds no audio or database file, and scans it with Trivy.
- `docs/DEPLOY.md`, the runbook for the Hetzner VPS, the library upload, releases and rollbacks.
- `robots.txt`, which disallows everything.

### Changed
- The browser tests' fixture catalog is written by `e2e/fixture-data.ts`, which the image check uses too.
- Dependabot also keeps the base image and Caddy digests current.

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
