// What players read for each theme: its name, and its world in one line, as the picker shows them
// (docs/exec-plans/completed/2026-10-01-theme-worlds.md). Ids are permanent once released; names may change.
import type { Theme } from '../prefs/prefs.ts';

export const THEME_NAMES: Record<Theme, string> = {
  'tokyo-rain': 'Neon Rain',
  karaoke: 'Karaoke Box',
  omikuji: 'Omikuji',
  'blossom-map': 'Blossom Map',
  shonen: 'Fighter Select',
  isekai: 'Quest Board',
  'retro-vhs': 'Back Issue',
  'side-a': 'Side A',
};

export const THEME_WORLDS: Record<Theme, string> = {
  'tokyo-rain': 'Holographic street ads over a rainy Tokyo crossing at night',
  karaoke: "The booth's lyric screen and song remote",
  omikuji: 'Shrine fortune slips in spring',
  'blossom-map': "A hanami park's guide map",
  shonen: 'An arcade character select',
  isekai: "The adventurers' guild notice board at night",
  'retro-vhs': 'An eighties monthly anime magazine',
  'side-a': "Side A of a friend's mixtape",
};
