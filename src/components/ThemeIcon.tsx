// Each theme's world as one object, drawn in its own colors for the picker's tiles: outlines in the theme's
// edge, paper in its card stock, marks in its card mark, and the world's hero color in its accent. Original
// shapes only; decoration, so hidden from screen readers.
import type { ReactNode } from 'react';
import type { Theme } from '../prefs/prefs.ts';

const ICONS: Record<Theme, ReactNode> = {
  // A bowl of ramen with chopsticks and steam.
  'tokyo-rain': (
    <>
      <path className="ti-out" d="M15 17c-2-3 2-5 0-8M21 17c-2-3 2-5 0-8" />
      <path className="ti-out" d="M33 5 25 24M38 7 29 24" />
      <path className="ti-paper ti-out" d="M6 24h36a18 18 0 0 1-36 0Z" />
      <path className="ti-mark-line" d="M9 31h30" />
      <path className="ti-accent" d="M18 41h12l-2 3h-8Z" />
    </>
  ),
  // A corner shop at night: a striped awning over a lit window and door.
  konbini: (
    <>
      <rect className="ti-paper ti-out" x="6" y="14" width="36" height="28" rx="1" />
      <path className="ti-accent" d="M5 9h38v7H5Z" />
      <path className="ti-mark-line" d="M5 16h38" />
      <rect className="ti-out" x="10" y="21" width="12" height="9" />
      <rect className="ti-out" x="27" y="21" width="10" height="21" />
    </>
  ),
  // A microphone, its grille lit.
  karaoke: (
    <>
      <path className="ti-out ti-thick" d="M26 22 11 41" />
      <circle className="ti-accent" cx="31" cy="15" r="9" />
      <path className="ti-mark-line" d="M25 11h12M24 15h14M25 19h12" />
      <path className="ti-paper ti-out" d="m22 24 5 4-3 4-5-4Z" />
    </>
  ),
  // A fortune slip, folded and knotted round a branch.
  omikuji: (
    <>
      <path className="ti-out ti-thick" d="M4 14c14-4 26-4 40 0" />
      <path className="ti-paper ti-out" d="M19 13h10v30H19Z" />
      <path className="ti-accent" d="M17 20h14v5H17Z" />
      <path className="ti-mark-line" d="M22 30v9M26 30v6" />
    </>
  ),
  // A folded park map with a pin.
  'blossom-map': (
    <>
      <path className="ti-paper ti-out" d="M5 14 17 9l14 5 12-5v26l-12 5-14-5-12 5Z" />
      <path className="ti-mark-line" d="M17 9v26M31 14v26" />
      <path className="ti-accent" d="M30 5a7 7 0 0 1 7 7c0 6-7 13-7 13s-7-7-7-13a7 7 0 0 1 7-7Z" />
      <circle className="ti-paper" cx="30" cy="12" r="2.5" />
    </>
  ),
  // An arcade stick and two buttons.
  shonen: (
    <>
      <rect className="ti-paper ti-out" x="4" y="28" width="40" height="13" rx="3" />
      <path className="ti-out ti-thick" d="M15 29V14" />
      <circle className="ti-accent" cx="15" cy="11" r="6" />
      <circle className="ti-mark" cx="29" cy="34" r="3" />
      <circle className="ti-mark" cx="37" cy="34" r="3" />
    </>
  ),
  // A sword, a spark of magic at its tip.
  isekai: (
    <>
      <path className="ti-paper ti-out" d="M36 6h6v6L21 33l-6-6Z" />
      <path className="ti-accent ti-out" d="m11 25 12 12-3 3-12-12Z" />
      <path className="ti-out ti-thick" d="m13 35-6 6" />
      <circle className="ti-accent" cx="6" cy="42" r="2.5" />
      <path className="ti-mark" d="m40 18 1.5 3.5L45 23l-3.5 1.5L40 28l-1.5-3.5L35 23l3.5-1.5Z" />
    </>
  ),
  // A magazine: its masthead, a cover feature and a line of type.
  'retro-vhs': (
    <>
      <path className="ti-paper ti-out" d="M10 5h28v38H10Z" />
      <path className="ti-accent" d="M13 9h22v6H13Z" />
      <rect className="ti-mark" x="13" y="19" width="12" height="12" />
      <path className="ti-mark-line" d="M28 21h7M28 25h7M28 29h5M13 35h22M13 39h16" />
    </>
  ),
  // A cassette: its label, its reels and the window between.
  'side-a': (
    <>
      <rect className="ti-paper ti-out" x="4" y="10" width="40" height="28" rx="3" />
      <path className="ti-accent" d="M8 14h32v7H8Z" />
      <rect className="ti-out" x="12" y="24" width="24" height="9" rx="4.5" />
      <circle className="ti-mark" cx="18" cy="28.5" r="2.5" />
      <circle className="ti-mark" cx="30" cy="28.5" r="2.5" />
      <path className="ti-out" d="m14 38 2-4h16l2 4" />
    </>
  ),
};

export function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="theme-icon">
      {ICONS[theme]}
    </svg>
  );
}
