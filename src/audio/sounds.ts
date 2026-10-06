// The game's sound effects (docs/product-specs/settings.md): each world's own voice for the deal, a pick, the
// overtime's call, a right or wrong answer and the results. They are synthesized from this table with Web Audio,
// so there are no files to license or ship; the engine plays them under the clip, at the game's volume.
import type { Theme } from '../prefs/prefs.ts';

export const CUES = ['deal', 'pick', 'overtime', 'right', 'wrong', 'results'] as const;
export type Cue = (typeof CUES)[number];

// One oscillator: its wave, its pitch in Hz (gliding to `to` when given), when it starts after the cue in seconds,
// how long it rings, and its peak level from 0 to 1.
export interface Tone {
  wave: OscillatorType;
  from: number;
  to?: number;
  at: number;
  length: number;
  level: number;
}

// The right card lands 820ms into the reveal (OptionCard's burst), and its sound with it.
export const CUE_DELAY_S: Partial<Record<Cue, number>> = { right: 0.82, wrong: 0.82 };

function tone(wave: OscillatorType, from: number, at: number, length: number, level = 0.5, to?: number): Tone {
  return to === undefined ? { wave, from, at, length, level } : { wave, from, to, at, length, level };
}

// Notes one after another, `step` seconds apart.
function run(wave: OscillatorType, pitches: number[], step: number, length: number, level = 0.5): Tone[] {
  return pitches.map((pitch, index) => tone(wave, pitch, index * step, length, level));
}

// A bell: a fundamental and its inharmonic partials, ringing long.
function bell(pitch: number, at: number, length: number, level = 0.5): Tone[] {
  return [
    tone('sine', pitch, at, length, level),
    tone('sine', pitch * 2.76, at, length * 0.6, level * 0.35),
    tone('sine', pitch * 5.4, at, length * 0.3, level * 0.15),
  ];
}

// A short knock with no clear pitch: a low tone falling fast.
function knock(pitch: number, at: number, level = 0.6): Tone {
  return tone('triangle', pitch, at, 0.08, level, pitch * 0.5);
}

const C4 = 261.63;
const E4 = 329.63;
const G4 = 392;
const A4 = 440;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;

export const SOUNDS: Record<Theme, Record<Cue, Tone[]>> = {
  // Synth blips, an LED alarm and a bright arpeggio.
  'tokyo-rain': {
    deal: [tone('sawtooth', 220, 0, 0.18, 0.2, 880)],
    pick: [tone('square', A5, 0, 0.06, 0.25)],
    overtime: run('square', [B5, E5, B5, E5], 0.14, 0.1, 0.22),
    right: run('sawtooth', [C5, E5, G5, C6], 0.06, 0.22, 0.22),
    wrong: [tone('sawtooth', 220, 0, 0.35, 0.25, 110)],
    results: [...run('sawtooth', [C5, E5, G5], 0.08, 0.5, 0.18), tone('sawtooth', C6, 0.24, 0.8, 0.2)],
  },
  // The booth's fanfare, and a trombone sliding down for a miss.
  karaoke: {
    deal: [knock(140, 0, 0.7)],
    pick: [tone('triangle', E5, 0, 0.08, 0.4)],
    overtime: run('triangle', [G4, G4, G4], 0.18, 0.12, 0.4),
    right: [...run('triangle', [G4, C5, E5], 0.1, 0.12, 0.45), tone('triangle', G5, 0.3, 0.45, 0.5)],
    wrong: [tone('sawtooth', 233, 0, 0.6, 0.25, 140)],
    results: [...run('triangle', [C5, C5, C5], 0.12, 0.1, 0.45), tone('triangle', G5, 0.36, 0.7, 0.5)],
  },
  // A shrine bell, and a wooden clack.
  omikuji: {
    deal: [knock(320, 0, 0.4), knock(320, 0.12, 0.35)],
    pick: [knock(520, 0, 0.45)],
    overtime: [...bell(A5, 0, 0.6, 0.3), ...bell(A5, 0.4, 0.6, 0.25)],
    right: bell(E5, 0, 1.6, 0.45),
    wrong: [knock(180, 0, 0.7), knock(150, 0.1, 0.5)],
    results: [...bell(C5, 0, 2, 0.4), ...bell(G5, 0.5, 1.6, 0.3)],
  },
  // Soft chimes in the park.
  'blossom-map': {
    deal: run('sine', [E5, G5], 0.08, 0.25, 0.3),
    pick: [tone('sine', C6, 0, 0.15, 0.3)],
    overtime: run('sine', [G5, E5, G5, E5], 0.15, 0.2, 0.25),
    right: run('sine', [C5, E5, G5, C6], 0.08, 0.5, 0.35),
    wrong: run('sine', [E4, C4], 0.12, 0.4, 0.35),
    results: run('sine', [C5, E5, G5, C6, E6], 0.1, 0.8, 0.3),
  },
  // The arcade's square-wave blips and a coin.
  shonen: {
    deal: run('square', [C5, G5], 0.05, 0.05, 0.2),
    pick: [tone('square', E6, 0, 0.05, 0.2)],
    overtime: run('square', [A5, A5, A5, A5, A5], 0.1, 0.05, 0.2),
    right: [tone('square', B5, 0, 0.08, 0.22), tone('square', E6, 0.08, 0.35, 0.22)],
    wrong: run('square', [G4, E4, C4], 0.1, 0.12, 0.22),
    results: run('square', [C5, E5, G5, C6, G5, C6], 0.09, 0.12, 0.2),
  },
  // A plucked lute and a low drum in the guild hall.
  isekai: {
    deal: [tone('triangle', D5, 0, 0.3, 0.35)],
    pick: [tone('triangle', A4, 0, 0.2, 0.4)],
    overtime: [knock(110, 0, 0.8), knock(110, 0.3, 0.7), knock(110, 0.6, 0.8)],
    right: run('triangle', [D5, A5, D5 * 2], 0.09, 0.6, 0.4),
    wrong: [knock(90, 0, 0.9), knock(80, 0.18, 0.7)],
    results: run('triangle', [D5, A4, D5, A5, D5 * 2], 0.12, 0.7, 0.4),
  },
  // Typewriter keys and the carriage's bell.
  'retro-vhs': {
    deal: [knock(1800, 0, 0.25), knock(1600, 0.07, 0.25), knock(1900, 0.13, 0.25)],
    pick: [knock(2000, 0, 0.35)],
    overtime: [knock(1800, 0, 0.3), knock(1800, 0.15, 0.3), knock(1800, 0.3, 0.3), knock(1800, 0.45, 0.3)],
    right: bell(C6, 0, 0.8, 0.3),
    wrong: [knock(140, 0, 0.8)],
    results: [knock(1800, 0, 0.25), knock(1700, 0.08, 0.25), ...bell(C6, 0.2, 1, 0.3)],
  },
  // A tape deck's click, a warm chord, and the tape dragging down.
  'side-a': {
    deal: [knock(900, 0, 0.35), knock(600, 0.05, 0.3)],
    pick: [knock(1200, 0, 0.3)],
    overtime: run('sine', [E5, E5, E5], 0.25, 0.15, 0.3),
    right: [tone('sine', C5, 0, 0.8, 0.25), tone('sine', E5, 0.03, 0.8, 0.2), tone('sine', G5, 0.06, 0.8, 0.2)],
    wrong: [tone('triangle', G4, 0, 0.6, 0.35, 120)],
    results: [tone('sine', C4, 0, 1.4, 0.25), tone('sine', G4, 0.1, 1.3, 0.2), tone('sine', E5, 0.2, 1.2, 0.2)],
  },
};
