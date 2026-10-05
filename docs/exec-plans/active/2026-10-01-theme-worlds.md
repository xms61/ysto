# Fifteen theme worlds

## Purpose
Each theme stops being a paint job on one shared layout and becomes its own world: it lays out the round, the reveal and the results in its own way. Seven themes become fifteen. A player sees it by opening Preferences, picking a theme, and playing a round: the four options, the timer, the lock-in, the reveal and the final standings all take that world's form.

## Context
- [PRODUCT.md](../../../PRODUCT.md): the product record, including the invariants below.
- [DESIGN.md](../../DESIGN.md): today's seven themes, the card anatomy, contrast, motion and the backdrop plates.
- [FRONTEND.md](../../FRONTEND.md), [CODE_STYLE.md](../../CODE_STYLE.md), [TESTING.md](../../TESTING.md).
- [Game flow](../../product-specs/game-flow.md) and [Settings](../../product-specs/settings.md): the phases and the theme preference.
- Code: `src/styles.css` (theme tokens and stocks), `src/prefs/prefs.ts` (`THEMES`, the saved theme), `src/components/PrefsPanel.tsx` (the picker), `src/components/Backdrop.tsx`, `src/screens/Round.tsx`, `src/screens/Reveal.tsx`, `src/screens/Results.tsx`, `src/themes.test.ts` (contrast).
- Image prompts for the plates the owner will supply: [PLATE_PROMPTS.md](../../PLATE_PROMPTS.md).

### What every theme keeps
- Four options of the same size and weight, shown at the same moment, never animated in. Their arrangement may change per theme: a 2x2 grid, a list, slanted panels, places on a map.
- WCAG AA in every theme (tested), keys 1 to 4, labeled controls, right and wrong shown with an icon and words.
- Motion only under the player's motion setting.
- Original shapes and OFL fonts; no series artwork, logos, character names or real brands.
- Text on a solid token color; the plate the only exception, held faint enough to pass.
- Home, lobby and preferences keep one shared structure, drawn in each theme's colors, type and ornament.

## The worlds
Chosen by the owner on 2026-10-01, one theme at a time, through the Impeccable shape rounds. The saved id never changes once released (AGENTS.md); four reshaped themes keep theirs, so players keep their choice.

| Id | Name | World | Round | Reveal and results |
| :-- | :-- | :-- | :-- | :-- |
| `tokyo-rain` | Tokyo Rain | A ramen ticket machine under the noren, out of the rain | The round on the noren, an amber LED counting seconds, four equal backlit buttons 2x2, keys on round coin lamps | The right button prints a ticket with the title, kind and year (the protocol sends no per-pick time); wrong ones light "Sold out"; results clip every ticket to the order rail, the leader's first |
| `konbini` | Konbini 2 a.m. | The one bright shop on a wet street | A register with a 7-segment countdown, a two-color shop stripe (never a real chain's), four marker-lettered price cards 2x2, keys in starbursts | Wrong cards marked down and stamped sold out; the answer prints as a receipt in thermal dot type; results are the night's last receipt with the standings as line items |
| `karaoke` | Karaoke Box | The booth's lyric screen and song remote | The lyric screen on top, the round title wiping white to pink as the timer; four song rows on the remote | Verdict on the lyric screen; results as the end-of-song score screen |
| `sakura` | Hanami | A lacquer bento on the blue picnic tarp | The tarp owns the page; a dango skewer loses a piece per step as the timer; four compartments 2x2 split by leaf dividers | Your compartment lifts with a doubled vermilion rim; wrong ones get their lid back, title still on it; results seat the players around the tarp |
| `omikuji` | Omikuji | Shrine fortune slips in spring | Four folded slips with brushed numerals | The right slip unfolds as the great blessing; the others are tied to the branch |
| `blossom-map` | Blossom Map | A hanami park's guide map in flat color lobes | Four viewing spots as capsules of one shared color at fixed places | Your chip crosses to the capsule's leading edge when chosen; the right spot blooms |
| `shonen` | Fighter Select | An arcade character select | A slanted round banner, a huge two-digit countdown, four fighter slots 2x2, your cursor frame in red | One inverted impact frame; results as a ranking screen with scores as health bars and answer times |
| `tournament-arc` | Tournament Arc | A semifinal bracket on the tournament board | Four entrant plates converging to the final, a referee's flag strip as the timer | Your pick advances along the line; the right entrant takes the final |
| `splash-page` | Splash Page | A battle manga page | Four slanted panels of equal area read right to left, titles in balloons, speed lines tightening as the timer | The right panel blows up into a full-bleed splash with sound-effect lettering |
| `night-arc` | Night Arc | The all-black pages of a manga's darkest chapter | White ink on a solid black page: a chapter header with the round in white brush capitals, white speed lines tightening from the edges as the timer, four equal black panels 2x2 in white frames, titles in white-ink balloons, numbers in the gutters | The right panel bursts to white; red spent rarely, only on the verdict |
| `mecha` | Model Kit | A plastic model kit runner and its manual | A manual step header "Step 3", one grey runner holding four parts 2x2 on gate tags A1 to A4, a nipper closing along the frame as the timer | The right part is cut and snaps into the assembly step |
| `magical-girl` | Gachapon | A capsule toy machine | The round on the machine head, the coin dial as the timer, four alike capsules in the dome 2x2, the title on a slip inside | Your capsule drops to the tray; wrong ones drop out of the dome; the right one opens on a charm; standings tumble in one capsule at a time |
| `isekai` | Quest Board | The adventurers' guild notice board | A carved plank with the round, a candle burning down as the timer, four notices pinned 2x2 with rank-stamp keys | The right notice gets the completed stamp |
| `retro-vhs` | Back Issue | An eighties monthly anime magazine | A masthead with "No. 03 / 15" at monumental size, a ruler strip as the timer, four feature boxes 2x2 under one shared process-color slab | Your pick is a ballot X; wrong boxes screened back under halftone; the answer page at the reveal; results are the readers' poll. Magenta only on what can be tapped |
| `side-a` | Side A | Side A of a friend's mixtape | The cassette with its reels as the timer, four handwritten tracks on a lined insert | A highlighter stroke on the right track, the song details written in |

## Plan
Each milestone is one or more PRs on `feat/…` branches with a version bump, a CHANGELOG entry and updated docs ([release process](../../../.github/RELEASE_PROCESS.md)).

1. **Theme stage.** Let a theme supply its own round, reveal and results layouts while the game logic, the server protocol and the accessibility contract stay shared: one theme registry (id, name, light or dark, fonts, layout set) replacing the bare `THEMES` list, and the current card layout as the fallback set. Rename the display names in the table; ids unchanged. Tests: every theme renders all phases, four equal options, keys 1 to 4, AA pairs.
2. **The picker.** Fifteen themes, no groups. Each theme shows as a live miniature of its own round (four tiny options in its own stock, which nested `data-theme` already allows), laid out as a strip the player flicks through, with a "Surprise me" that rolls a random theme. Shaped with the owner before it is built.
3. **The reshaped seven**, one PR each, each with its direction contract in its own surface brief: Tokyo Rain, Hanami, Fighter Select, Model Kit, Gachapon, Quest Board, Back Issue.
4. **The eight new themes**, one PR each: Konbini 2 a.m., Karaoke Box, Omikuji, Blossom Map, Tournament Arc, Splash Page, Night Arc, Side A.
5. **Plates.** As the owner supplies images from [PLATE_PROMPTS.md](../../PLATE_PROMPTS.md): scale, encode, set the opacity, pass the plate contrast check, record each origin in DESIGN.md. Until then a theme runs without a plate or with the reused one named there.
6. **DESIGN.md** rewritten from the built worlds, theme by theme, in the PR that builds each.

## Progress
- [x] 2026-10-01 Shape every theme with the owner; worlds, names and invariants recorded above
- [x] 2026-10-01 Plate prompts written for the owner
- [x] 2026-10-01 Fifteen theme ids, the new names, provisional tokens for the eight new themes, and all fifteen plates (v0.14.0)
- [x] 2026-10-01 Theme stage (`src/themes/stage.ts`: readout and wrong mark), with Tokyo Rain (v0.15.0)
- [ ] The picker
- [x] 2026-10-01 Tokyo Rain: the ramen ticket machine (v0.15.0); the cabinet and motion (v0.18.0)
- [x] 2026-10-05 Tokyo Rain: the noren as cloth (v0.18.4)
- [x] 2026-10-05 The listening ring centered on the headphones in every phase (v0.18.2)
- [x] 2026-10-05 The lobby's start bar on the viewport's foot, in the rebuilt worlds' material (v0.18.3)
- [x] 2026-10-01 Who picked each option, shown at the reveal in every theme (v0.15.0)
- [x] 2026-10-02 Hanami: the lacquer bento on the blue tarp, with the dango timer (v0.16.0)
- [x] 2026-10-02 Fighter Select: the arcade character select, with arcade digits and health bars (v0.17.0)
- [ ] Model Kit
- [ ] Gachapon
- [ ] Quest Board
- [ ] Back Issue
- [ ] Konbini 2 a.m.
- [ ] Karaoke Box
- [ ] Omikuji
- [ ] Blossom Map
- [ ] Tournament Arc
- [ ] Splash Page
- [ ] Night Arc
- [ ] Side A
- [x] 2026-10-01 Plates in place for all fifteen

## Where to pick up
State on 2026-10-05: v0.18.4 closes the three open review findings (the listening ring, the lobby's start bar, Tokyo Rain's noren). Tokyo Rain, Hanami and Fighter Select are rebuilt with their motion; the other twelve themes run on the shared card layout with their own tokens and plates.

Do next: Model Kit, shaped with the owner first (its direction contract in its own surface brief), following the rules under Owner review findings.

Working notes for a new session:
- Check a theme by eye with `npm run build`, then the "start" preview (production server on :5173), a solo lobby, and `localStorage.ysto_prefs` set to the theme with `motion: 'full'` to see motion or `'reduced'` for steady screenshots. A solo answer ends the round at once; set Songs per game to 5 to reach the results quickly.
- Run `npx playwright test --project=chromium --project=firefox` locally; WebKit can't decode audio on the owner's Windows machine, so CI covers it.
- Date `last-verified` by `date -u +%F`; CI rejects a date ahead of UTC.
- Each world: tokens in its `[data-theme]` block (contrast in `src/themes.test.ts`, world-only pairs in `WORLD_TEXT_PAIRS`), its stock section in `src/styles.css`, its stage fields in `src/themes/stage.ts`, its motion in the theme-worlds motion section, its plate opacity from the plate check, and its rows and paragraph in DESIGN.md.

## Owner review findings
What the owner found playing the built worlds on 2026-10-02, and where each stands. A finding that is fixed stays here with its version, so the next world avoids it from the start.

| Finding | Theme | Status |
| :-- | :-- | :-- |
| The rebuilt worlds read blander than the stocks they replaced: the shared motion still ran, but no world had moves of its own, and Tokyo Rain had lost its letter flap | Tokyo Rain, Hanami, Fighter Select | Fixed in v0.18.0: each world's own motion. Rule for every later world below |
| Only Tokyo Rain's buttons read as a ticket machine; the panel around them was a generic dark box | Tokyo Rain | Fixed in v0.18.0: the round panel is the cabinet, with a grille, a recessed bank, an outlet and a coin slot |
| The noren at the top is a flat indigo band with two hairline slits; it reads as a header bar, not as cloth hanging over a shop's door | Tokyo Rain | Fixed in v0.18.4: a pole across the top, the heading on a solid indigo panel, and below it a hem of four panels with the cabinet between them, a white band and a split crest, an uneven hem, and a slow sway while the clip plays |
| The lobby's start bar is sticky inside the lobby panel, so scrolling to the end lifts it with the panel's foot and the backdrop shows below; it is also outside every theme's world | Every theme | Fixed in v0.18.3: the bar reaches through the page column's bottom padding to the viewport's foot, and the three rebuilt worlds print it on their own material; `e2e/phone.spec.ts` checks the foot in five worlds |
| At round start the listening ring sits off-center from the headphones | Every theme | Fixed in v0.18.2: the ring field also watches the headphones' sonar box and remeasures once web fonts land; `e2e/phone.spec.ts` checks the center on a phone in five worlds |

### Rules every later world follows
- **The world fills the round's panel, not only the options.** The heading, the readout, the listening light and the panel's own frame belong to the world, the way the whole cabinet is Tokyo Rain's machine. Check the full panel at 375 px, not the cards alone.
- **The world moves.** One authored moment at the reveal and a little feedback on the pick, built in the same PR, motion-gated, and checked with motion on in a real game (record the animation names firing, as in v0.18.0).
- **No flat bars.** A header or footer that is a plain colored strip is the generic version; draw the world's object instead (cloth, a sign, a plank, a screen).

## Decision log
- 2026-10-01: Each theme may lay out the round, reveal and results its own way; home, lobby and preferences stay shared, because that gives each world its signature moments at a fraction of fourteen full flows. Rejected: skin-only themes; every screen per theme.
- 2026-10-01: Option geometry may bend per theme while all four stay equal, because a vertical strip or a map is what several worlds are. Every other invariant holds.
- 2026-10-01: Where the owner took several cards in one round, the card the owner chose on the decision page keeps the theme's id and the rest become new themes; Tokyo Rain kept its name and got its own round.
- 2026-10-01: Display names follow the worlds (Model Kit, Gachapon, Quest Board, Back Issue, Hanami, Fighter Select); ids stay, because renaming an id resets players' saved theme.
- 2026-10-01: The picker is one ungrouped strip of live miniatures, because the owner asked for something creative rather than groups.
- 2026-10-01: Overlaps between worlds (three rainy nights, two machines, three battle themes) are accepted for now; each keeps its own palette and type, and any clash is fixed later.
- 2026-10-01: The owner supplies the plate images, since this project has no image generation.

- 2026-10-01: A fifteenth theme, Night Arc, gives the manga page a dark mode: the owner asked for one, and Splash Page and Fighter Select are both light or arcade. Rejected: Cut-In strips and Final Volume spines.

- 2026-10-01: The eight new themes ship first on the shared card layout with their own tokens and plates, and the theme stage lands with the first theme that needs it, because a layout registry with no second layout would be a speculative abstraction (CODE_STYLE.md).

- 2026-10-01: The reveal names who picked each option, under its card, in every theme, because the owner asked for it. Picks already travel only in the reveal, which the server sends once the round has closed for everyone, so nothing shows while anyone can still answer.
- 2026-10-01: The stage is a small table of what a world changes (the readout and the wrong mark) read through a context, not a set of per-theme screen components; each later world adds the fields it needs.

- 2026-10-02: Hanami's plate shows at 0.05, barely there: the tarp is now the page color itself, and a stronger blend of the plate's bright blossom breaks the page's contrast.

- 2026-10-02: Every world ships its own motion in the PR that builds it: one authored moment and a little feedback, motion-gated like the rest. The first three worlds shipped without it and read blander than the stocks they replaced (owner's review), so v0.18.0 added theirs. Tokyo Rain's whole round panel became the machine at the same review, since the buttons alone did not read as a ticket machine.

## Surprises
- 2026-10-01: The protocol sends no per-pick answer time, so Tokyo Rain's ticket carries the title, kind and year instead of the answer time the shape promised.
- 2026-10-01: The supplied Tokyo Rain plate carries made-up glyph marks on its lanterns; the encode blurs it slightly so nothing reads as text.

## Validation
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:web`.
- `npm run build && npm run test:e2e`: a whole game in each theme.
- `node scripts/check-plate-contrast.mjs` after each plate.
- `node scripts/check-docs.mjs`.
- By eye: each theme at 390 px and 1280 px through countdown, options, locked in, reveal and results.

## Outcome
