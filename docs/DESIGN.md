---
status: verified
last-verified: 2026-09-29
---

# Design

How the app looks, moves and reads. How the UI code is built is in [FRONTEND.md](FRONTEND.md).

## Design system
There are three themes, and each player picks one on their device ([settings](product-specs/settings.md)):

| Theme | Colors | Texture and motion | Display type |
| :-- | :-- | :-- | :-- |
| Tokyo Rain (default) | dark navy, neon cyan and pink | neon glows in the corners, falling rain, a flickering neon title | Tilt Neon, with a glow |
| Sakura | pastel pink on white | soft blossom light, falling petals, round corners | M PLUS Rounded 1c |
| Shonen | black, orange and yellow | halftone dots, speed lines, square corners with an offset shadow, a burst behind each answer | Anton, in capitals |

Each theme is one block of CSS variables in `src/styles.css`, on any element with `data-theme`:
- Colors: `page`, `panel`, `raised`, `line`, `edge`, `ink`, `muted`, `accent`, `accent-ink`, `good` and `bad`, used as Tailwind utilities such as `bg-panel`. `edge` outlines form fields; `line` is for dividers and quiet borders.
- Type: the display font, weight, case, tracking and glow, used through the `.display` class for headings, the countdown and primary buttons.
- Shape: Tailwind's `rounded-lg`, `rounded-xl` and `rounded-2xl`, which each theme resizes, and the panel shadow.
- Texture: the page background, which only shows between panels.

Components use only these tokens, so the theme picker can show each theme in its own colors and type. Text always sits on a solid token color, never on a texture.

Display fonts are self-hosted (OFL-licensed, Latin only, about 20 KB each), and only the chosen theme's font loads. Body text and titles use the system fonts, with the system's Japanese fonts for Japanese titles (`lang="ja"`). Every platform the game targets ships them, and a self-hosted Japanese font would weigh megabytes and could swap the options' text while players read it.

## Layout and motion
- Mobile first: every screen works one-handed on a phone from 360 px wide, and scales up to desktop.
- The four options are large tap targets, and keys 1–4 select them on a keyboard. The hint about the keys shows only where a mouse or trackpad suggests a keyboard.
- The device settings (volume, theme, title language, motion) sit behind the Preferences button on every screen, so the volume is one tap away during a round.
- The lobby's start button stays in view at the bottom of the screen, with the number of songs and anime that match, however long the settings form gets.
- Motion (petals, rain, the neon flicker, the reveal's rise, pop and burst, the countdown's tick) is decoration. It never carries information, and it runs only when the page's `data-motion` is `full`: the player's motion setting, or else the device's `prefers-reduced-motion`. Reduced motion also turns off transitions.
- The options never animate in, so every player can read them the moment the clip starts, whatever their settings.

## UI copy
- Short, plain English in sentence case. The only exclamation marks are in the game's name and the playful reveal line: a wrong or missing answer earns "You skipped the OP?!" (or the ED) ([product sense](PRODUCT_SENSE.md)).
- Errors say what happened and what to do next: "That code doesn't match a lobby. Check it with the host." Never just "Error".

## Accessibility
- Every theme meets WCAG AA contrast: 4.5:1 for text, 3:1 for icons, field borders and focus outlines. `src/themes.test.ts` checks the token pairs, and axe checks every screen in every theme (`e2e/a11y.spec.ts`).
- Right and wrong answers are shown with an icon and text, never by color alone.
- The game works with the keyboard alone, and screen readers get labeled controls.
- Audio is the quiz itself, so it has no text alternative. The reveal gives the answer in text.
- Volume is adjustable at any time, starting at 15%.

## Styles to avoid
- No official artwork, logos, character names or fonts from One Piece, Naruto, Dragon Ball or any other series. The themes only evoke the genres, with original shapes and open fonts.
- No green-and-red-only feedback, and no information carried by color alone.
- No autoplaying audio before the player's first tap.
- No emoji in UI copy.
