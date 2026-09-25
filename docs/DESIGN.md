---
status: draft
last-verified: 2026-09-25
---

# Design

How the app looks, moves and reads. How the UI code is built is in [FRONTEND.md](FRONTEND.md).

## Design system
There are three themes, and each player picks one on their device ([settings](product-specs/settings.md)). Each theme is a token set (colors, type, texture, motion) exposed as CSS variables:
- **Shonen:** bold orange, black and yellow, with halftone and speed lines and heavy condensed type.
- **Sakura:** pastel pink, falling petals and soft rounded type.
- **Tokyo Rain:** the default. Dark navy with neon signs, rain on glass and glow.

Fonts are self-hosted and cover Japanese, because titles can show in Japanese. The tokens and components are built in M7. Until then the app uses Tailwind's slate palette on a dark background.

## Layout and motion
- Mobile first: every screen works one-handed on a phone from 360 px wide, and scales up to desktop.
- The four options are large tap targets, and keys 1–4 select them on a keyboard.
- Motion (petals, rain, speed lines, reveal transitions) is decoration. It never carries information, and it stops under `prefers-reduced-motion` or the player's reduced-motion setting.

## UI copy
- Short, plain English in sentence case. The only exclamation marks are in the game's name and the playful reveal line ([product sense](PRODUCT_SENSE.md)).
- Errors say what happened and what to do next: "That code doesn't match a lobby. Check it with the host." Never just "Error".

## Accessibility
- Every theme meets WCAG AA contrast.
- Right and wrong answers are shown with an icon and text, never by color alone.
- The game works with the keyboard alone, and screen readers get labeled controls.
- Audio is the quiz itself, so it has no text alternative. The reveal gives the answer in text.
- Volume is adjustable at any time, starting at 15%.

## Styles to avoid
- No official artwork, logos, character names or fonts from One Piece, Naruto, Dragon Ball or any other series. The themes only evoke the genres.
- No green-and-red-only feedback, and no information carried by color alone.
- No autoplaying audio before the player's first tap.
- No emoji in UI copy.
