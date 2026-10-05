// What players read for each theme: its name, and its world in one line, as the picker shows them
// (docs/exec-plans/completed/2026-10-01-theme-worlds.md). Ids are permanent once released; names may change.
import type { Theme } from '../prefs/prefs.ts';

export const THEME_NAMES: Record<Theme, string> = {
  'tokyo-rain': 'Tokyo Rain',
  konbini: 'Konbini 2 a.m.',
  karaoke: 'Karaoke Box',
  sakura: 'Hanami',
  omikuji: 'Omikuji',
  'blossom-map': 'Blossom Map',
  shonen: 'Fighter Select',
  'tournament-arc': 'Tournament Arc',
  'splash-page': 'Splash Page',
  'night-arc': 'Night Arc',
  mecha: 'Model Kit',
  'magical-girl': 'Gachapon',
  isekai: 'Quest Board',
  'retro-vhs': 'Back Issue',
  'side-a': 'Side A',
};

export const THEME_WORLDS: Record<Theme, string> = {
  'tokyo-rain': 'A ramen ticket machine under the noren, out of the rain',
  konbini: 'The one bright shop on a wet street',
  karaoke: "The booth's lyric screen and song remote",
  sakura: 'A lacquer bento on the blue picnic tarp',
  omikuji: 'Shrine fortune slips in spring',
  'blossom-map': "A hanami park's guide map",
  shonen: 'An arcade character select',
  'tournament-arc': 'A semifinal bracket on the tournament board',
  'splash-page': 'A battle manga page',
  'night-arc': "The all-black pages of a manga's darkest chapter",
  mecha: 'A plastic model kit and its manual',
  'magical-girl': 'A capsule toy machine on a sunny street',
  isekai: "The adventurers' guild notice board at night",
  'retro-vhs': 'An eighties monthly anime magazine',
  'side-a': "Side A of a friend's mixtape",
};
