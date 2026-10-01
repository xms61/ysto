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

// Pairs only a theme's own world draws: Tokyo Rain's heading on its noren.
const WORLD_TEXT_PAIRS: Partial<Record<(typeof THEMES)[number], [text: string, background: string][]>> = {
  'tokyo-rain': [['noren-ink', 'noren']],
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
