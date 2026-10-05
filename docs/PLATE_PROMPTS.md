---
status: draft
last-verified: 2026-10-05
---

# Backdrop plate prompts

Image prompts for the backdrop plate behind each of the fifteen theme worlds ([plan](exec-plans/completed/2026-10-01-theme-worlds.md)). The owner generates the images; the rules they must meet are in [DESIGN.md](DESIGN.md) under The backdrop plates.

## How to use them
- Paste the theme's prompt followed by the shared ending below, as one prompt.
- Save the result as `src/assets/plates/<id>.png` (any size at least 1600 px wide). The build scales it to 1600 px, encodes it as WebP with ffmpeg, sets `--plate-opacity`, and runs `node scripts/check-plate-contrast.mjs`.
- Note the tool and model you used; DESIGN.md records each plate's origin.
- Reject an image that shows any text, logo, person or character, even small or in the background, and generate again.

## Shared ending
Add this to every prompt:

> Wide 16:9 landscape. Soft focus and low contrast, with a calm, open, almost empty center and the detail pushed toward the edges, because it sits faintly behind text. An original scene, not taken from any anime, game or film. No people, no characters, no faces, no text, letters, numbers, signs, labels or logos anywhere.

## Prompts
Light plates sit behind the light themes, dark plates behind the dark ones. "Reuse" marks a plate already in `src/assets/plates/` that fits the new world; replace it only if you want to.

| Id | Name | Tone | Prompt |
| :-- | :-- | :-- | :-- |
| `tokyo-rain` | Tokyo Rain | Dark | A narrow Tokyo back alley at night in heavy rain, seen from just inside a small ramen counter: the edge of an indigo cloth door curtain at the top, warm amber light spilling onto wet black asphalt, puddles reflecting blurred lanterns, steam drifting. Deep navy and amber, painted. |
| `konbini` | Konbini 2 a.m. | Dark | A wet city street at two in the morning, the cold white light of a convenience store spilling from the right edge across rain-soaked pavement, a parked bicycle and a vending glow far off, everything else dark navy. Cinematic, painted, very quiet. |
| `karaoke` | Karaoke Box | Dark | The inside of an empty small karaoke booth after midnight, seen softly out of focus: a curved vinyl bench along the bottom edge, a low table with two empty glasses, scattered pink and cyan light spots from a slowly turning mirror ball on the dark walls. Deep indigo with pink and cyan. |
| `sakura` | Hanami | Dark | Looking straight down at a blue plastic picnic tarp spread on grass in a park, the edges of the frame shaded by cherry branches in full bloom, petals scattered across the tarp, dappled spring sunlight. Saturated tarp blue, blossom pink and leaf green; the middle of the tarp empty. |
| `omikuji` | Omikuji | Light | A shrine courtyard in early spring, very pale and misty: a low wooden rack along the bottom where many folded white paper fortunes are tied in knots, a blossoming branch drooping in from the top corner, soft vermilion of a gate far off in the haze. Washed-out watercolor. |
| `blossom-map` | Blossom Map | Light | A flat, cheerful illustrated bird's-eye view of a city park in spring, in the style of a printed guide map: soft rounded lobes of flat green lawn, a pale pond, winding paths, round pink cherry tree clusters around the edges, no shading, no grain, no labels. |
| `shonen` | Fighter Select | Dark | The stage of an original 2D fighting game: a rooftop dojo at dusk above a city, paper lanterns along the eaves, a dramatic orange and violet sky, painted in the bold style of nineties arcade backgrounds. The floor of the stage empty. |
| `tournament-arc` | Tournament Arc | Light | A martial arts tournament arena of pale stone set in a mountain valley, empty stands in the distance, banners hanging blank, rendered in sumi ink wash and light screentone on warm grey newsprint. |
| `splash-page` | Splash Page | Light | Reuse `shonen.webp` (a rocky training ground at a cliff edge in manga ink and screentone). To make a new one: a ruined battlefield on a cliff top after a fight, cracked rocks and dust, huge radiating speed lines from the center, black ink and screentone on white. |
| `night-arc` | Night Arc | Dark | A ruined city skyline at night under a huge full moon, drawn entirely in white ink on solid black like the inverted pages of a manga's darkest chapter: white hatching, inverted screentone, broken rooftops along the bottom edge, white speed lines faint at the corners. Only black and white. |
| `mecha` | Model Kit | Light | Top-down view of a hobbyist's workbench under daylight: a green self-healing cutting mat with a fine grid, side cutters, a hobby knife, small paint pots, sanding sticks and a few loose grey plastic parts at the edges, the center of the mat clear. Clean, bright, soft shadows. |
| `magical-girl` | Gachapon | Light | A row of colorful capsule toy machines outside a small toy shop on a sunny shopping street, out of focus, clear domes full of round two-tone capsules catching the light, candy red, lemon yellow and sky blue, pastel bokeh. |
| `isekai` | Quest Board | Dark | The empty common room of a fantasy adventurers' guild at night: heavy oak beams, a long wooden counter, a cold hearth, candle and lantern light pooling warm on dark wood, a large blank notice board on the far wall. Painterly, warm browns and deep shadow. |
| `retro-vhs` | Back Issue | Light | A bold abstract composition from eighties offset printing: overlapping flat shapes in process magenta, cyan and yellow, slightly misregistered, coarse halftone dots in the overlaps, on glossy white paper. Purely geometric, no letters. |
| `side-a` | Side A | Dark | Reuse `retro-vhs.webp` (an eighties coastal highway at dusk with palm silhouettes and a striped sunset). To make a new one: a teenager's desk at night in the late eighties, a cassette deck and a loose tangle of tape, a desk lamp's warm pool of light, a window with a blue night sky beyond, softly out of focus. |

## Quest Board monster sprites
Each of Quest Board's four notices carries a monster drawn faintly in ink behind its title, like the creature on a guild bounty poster. The owner's sprites are in place (`src/assets/notices/*.webp`); these prompts remake them.

- Paste the monster's prompt followed by the sprite ending below, as one prompt.
- Save the result as `src/assets/notices/<name>.png`, square, at least 1024 px, on a transparent or plain light background. Git ignores the PNG. It becomes an ink layer with ffmpeg: scaled to 512 px, every light neutral pixel (white or grey, so a painted-in checkerboard too) made transparent, and every other pixel drawn in sepia ink as strong as it is dark, capped at 0.28, which keeps the title at 7:1 over it; then encoded as WebP:

  ```bash
  ffmpeg -i <name>.png -vf "scale=512:512:flags=lanczos,format=rgba,geq=r='59':g='36':b='20':a='255*if(lt(abs(r(X,Y)-b(X,Y)),16)*gt(0.2126*r(X,Y)+0.7152*g(X,Y)+0.0722*b(X,Y),150),0,min(0.28,0.28*(255-(0.2126*r(X,Y)+0.7152*g(X,Y)+0.0722*b(X,Y)))/200))'" -c:v libwebp -q:v 85 -pix_fmt yuva420p <name>.webp
  ```
- Reject an image with any text, runes, signature, frame, ground shadow, skull or bones, or a creature from an existing game, anime or film, and generate again.

Sprite ending, added to every prompt:

> A bestiary illustration for a fantasy guild's bounty notice: monochrome dark sepia ink linework with light graphite shading, like a careful pencil-and-ink sketch on old paper, no color. One full-body creature, centered, filling about 80% of a square frame, three-quarter view. Isolated on a fully transparent background: no paper texture, no ground, no cast shadow, no border or frame. An original creature, not from any game, anime or film. No text, letters, numbers, runes, signatures or watermarks anywhere. No skulls, no bones, no blood.

| Name | Notice | Prompt |
| :-- | :-- | :-- |
| `slime` | 1 | A large round slime monster, a glossy dome of jelly with two small dark eyes and a wide wobbly smile, a few drips running off its sides, a small sword stuck in its back, mischievous rather than scary. |
| `beast` | 2 | A hulking tusked boar beast standing on two legs, heavy shoulders and a thick hide, two long curved tusks and a pair of ram-like horns, a short ragged mane, small fierce eyes, a crude belt of rope. |
| `wyvern` | 3 | A young wyvern with wide bat-like wings half spread, a long neck and a horned head, two clawed legs gripping a rock, a barbed tail curling round, scales sketched along its back. |
| `golem` | 4 | A stone golem built from rough stacked boulders, a small square head with two glowing slit eyes drawn as empty ink outlines, massive arms reaching the ground, moss and small flowers growing in its cracks, cracks running across its chest. |
