// Checks that text and graphics drawn straight on the page stay readable over each theme's backdrop plate.
// Each plate is decoded with ffmpeg, blended over the theme's page color at its --plate-opacity, and every
// pixel is tested: text needs 4.5:1 (WCAG AA), graphics 3:1. Panels and cards are opaque, so only the page
// pairs are checked. Usage: node scripts/check-plate-contrast.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = new URL('../src/styles.css', import.meta.url);
const PLATES_DIR = new URL('../src/assets/plates/', import.meta.url);
const THEMES = [
  'tokyo-rain',
  'konbini',
  'karaoke',
  'omikuji',
  'blossom-map',
  'shonen',
  'isekai',
  'retro-vhs',
  'side-a',
];
const DEFAULT_OPACITY = 0.5;
// Wide enough that a highlight the size of a letter still counts, as a plate is shown at about this size.
const SAMPLE_WIDTH = 800;
const PAIRS = [
  ['ink', 4.5],
  ['muted', 4.5],
  ['bad', 4.5],
  ['edge', 3],
  ['accent', 3],
];

function themeBlock(css, theme) {
  return new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function tokens(block) {
  const colors = Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*#([0-9a-f]{6});/g)].map(([, name, hex]) => [
      name,
      [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)),
    ]),
  );
  const opacity = /--plate-opacity:\s*([\d.]+);/.exec(block)?.[1];
  return { colors, opacity: opacity === undefined ? DEFAULT_OPACITY : Number(opacity) };
}

function linear(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a, b) {
  const [light, dark] = [a, b].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function platePixels(theme) {
  const path = fileURLToPath(new URL(`${theme}.webp`, PLATES_DIR));
  const args = [
    '-v',
    'error',
    '-i',
    path,
    '-vf',
    `scale=${SAMPLE_WIDTH}:-2`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-',
  ];
  return execFileSync('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024 });
}

// The page's luminance range once the plate is blended over the page color, as the browser does, in sRGB.
function blendedRange(pixels, page, opacity) {
  let darkest = 1;
  let lightest = 0;
  for (let index = 0; index < pixels.length; index += 3) {
    const color = [0, 1, 2].map((channel) => page[channel] * (1 - opacity) + pixels[index + channel] * opacity);
    const value = luminance(color);
    darkest = Math.min(darkest, value);
    lightest = Math.max(lightest, value);
  }
  return { darkest, lightest };
}

const css = readFileSync(CSS_PATH, 'utf8');
let failed = false;
for (const theme of THEMES) {
  const { colors, opacity } = tokens(themeBlock(css, theme));
  const { darkest, lightest } = blendedRange(platePixels(theme), colors.page, opacity);
  const results = PAIRS.map(([name, needed]) => {
    const front = luminance(colors[name]);
    const crossed = front >= darkest && front <= lightest;
    const worst = crossed ? 1 : Math.min(contrast(front, darkest), contrast(front, lightest));
    if (worst < needed) failed = true;
    return `${name} ${worst.toFixed(2)}${worst < needed ? ` (needs ${needed})` : ''}`;
  });
  console.log(`${theme} at ${opacity}: ${results.join(', ')}`);
}
process.exitCode = failed ? 1 : 0;
