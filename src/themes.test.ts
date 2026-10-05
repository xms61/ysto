import { expect, test } from 'vitest';
import { THEMES } from './prefs/prefs.ts';
import css from './styles.css?raw';

// WCAG 2 relative luminance and contrast ratio of #rrggbb colors.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

// A theme's color tokens, read from its block in styles.css.
function colorsOf(theme: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map(([, name, value]) => [name, value]),
  );
}

// Text needs 4.5:1 (WCAG AA); icons, field borders and focus outlines need 3:1.
const TEXT_PAIRS: [text: string, background: string][] = [
  ['ink', 'page'],
  ['ink', 'panel'],
  ['ink', 'raised'],
  ['muted', 'page'],
  ['muted', 'panel'],
  ['muted', 'raised'],
  ['accent-ink', 'accent'],
  ['bad', 'page'],
  ['bad', 'panel'],
  // The scoreboard's round result, in the right or wrong color on a player's row and on this player's raised row.
  ['good', 'panel'],
  ['good', 'raised'],
  ['bad', 'raised'],
  // The card stock: a card, a dimmed card, a chosen card, a turned card's back, the index mark, and the
  // stamp on a wrong pick.
  ['card-ink', 'card'],
  ['card-muted', 'card'],
  ['card-muted', 'card-dim'],
  ['card-chosen-ink', 'card-chosen'],
  ['card-back-ink', 'card-back'],
  ['card-mark-ink', 'card-mark'],
  ['card-alert', 'card'],
];
const GRAPHIC_PAIRS: [graphic: string, background: string][] = [
  ['edge', 'page'],
  ['edge', 'panel'],
  ['accent', 'page'],
  ['accent', 'panel'],
  ['good', 'panel'],
  ['bad', 'panel'],
  ['card-mark', 'card'],
  // The verdict's badge: its icon in the page color on a right or wrong fill.
  ['page', 'good'],
  ['page', 'bad'],
];

// Pairs only a theme's own world draws: Tokyo Rain's heading on its noren and the round's text on the machine's
// cabinet, Konbini's heading on its sign and its receipt's grey and inverse print, Karaoke Box's lyric screen,
// Omikuji's heading on its torii beam and its brushed numerals, Tournament Arc's heading on its banner, Side A's
// heading on its tape label and its titles under the highlighter, Fighter Select's titles on their plates, Model
// Kit's step header on the manual and the round's text on the cutting mat, Gachapon's heading on the machine's head
// and its titles on their slips, Quest Board's heading on its plank, the round's text on the board and the rank and
// completed stamps in red ink, Back Issue's ink on its yellow slab and screened text over its halftone.
const WORLD_TEXT_PAIRS: Partial<Record<(typeof THEMES)[number], [text: string, background: string][]>> = {
  'tokyo-rain': [
    ['noren-ink', 'noren'],
    ['ink', 'machine'],
    ['muted', 'machine'],
    ['bad', 'machine'],
    ['good', 'machine'],
  ],
  konbini: [
    ['sign-ink', 'sign'],
    ['receipt-muted', 'card-back'],
    ['card-back', 'card-back-ink'],
  ],
  karaoke: [
    ['screen-ink', 'screen'],
    ['screen-muted', 'screen'],
    ['lyric-sung', 'screen'],
    ['lyric-edge', 'screen'],
  ],
  omikuji: [
    ['beam-ink', 'beam'],
    ['card-mark', 'card'],
  ],
  'tournament-arc': [['banner-ink', 'banner']],
  'side-a': [
    ['label-ink', 'label'],
    ['card-ink', 'accent'],
  ],
  shonen: [['card-ink', 'nameplate']],
  'magical-girl': [
    ['head-ink', 'head'],
    ['card-ink', 'slip'],
  ],
  isekai: [
    ['plank-ink', 'plank'],
    ['ink', 'board'],
    ['muted', 'board'],
    ['good', 'board'],
    ['bad', 'board'],
    ['card-mark', 'card'],
    ['card-mark', 'card-back'],
  ],
  'retro-vhs': [
    ['ink', 'slab'],
    ['card-muted', 'halftone'],
  ],
  mecha: [
    ['manual-ink', 'manual'],
    ['manual-muted', 'manual'],
    ['ink', 'mat'],
    ['muted', 'mat'],
    ['good', 'mat'],
    ['bad', 'mat'],
  ],
};

test.each(THEMES)('%s meets AA contrast for text and graphics', (theme) => {
  const colors = colorsOf(theme);
  const ratio = ([front, back]: [string, string]) => {
    const [a, b] = [colors[front], colors[back]];
    if (!a || !b) throw new Error(`${theme} has no ${front} or ${back} color`);
    return contrast(a, b);
  };
  for (const pair of [...TEXT_PAIRS, ...(WORLD_TEXT_PAIRS[theme] ?? [])]) {
    expect(ratio(pair), `${theme}: ${pair.join(' on ')}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const pair of GRAPHIC_PAIRS) expect(ratio(pair), `${theme}: ${pair.join(' on ')}`).toBeGreaterThanOrEqual(3);
});
