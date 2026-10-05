// What a theme's world changes in the round beyond its stock (docs/DESIGN.md#theme-worlds): how the time left
// reads, the mark printed on an option that was not the answer, whether the results draw each score as a bar,
// whether the round's heading is set as a masthead, and whether the options stand in one column of rows. A theme
// that sets nothing plays the shared round. The stage never changes what the four options are or when they show,
// only how they are drawn.
import { createContext, useContext } from 'react';
import type { Theme } from '../prefs/prefs.ts';

export interface ThemeStage {
  // How the time left reads: the shared bar; a seven-segment display; a dango skewer eaten down; the seconds as
  // huge arcade digits; a nipper cutting along a runner; a gachapon's coin dial turning; a candle burning down; a
  // printer's ruler; the round's heading sung like a lyric line; a shrine rope's paper streamers taken one by one;
  // a walk on a park map toward a blossom tree; the referee's pennants taken down one by one; a manga panel's focus
  // lines closing in on its center; or a cassette's tape winding from one reel to the other.
  readout:
    | 'bar'
    | 'segments'
    | 'dango'
    | 'digits'
    | 'nipper'
    | 'dial'
    | 'candle'
    | 'ruler'
    | 'lyric'
    | 'shide'
    | 'route'
    | 'pennants'
    | 'focus'
    | 'reels';
  wrongMark: string | null; // printed on each option that was not the answer, at the reveal
  scoreBars: boolean; // each final score also drawn as a bar against the winner's, like a health bar
  masthead: boolean; // the round's heading set as a magazine's issue number, "No. 03 / 15"
  rows: boolean; // the four options in one column, like songs on a karaoke remote or a tape's insert, not 2x2
}

const SHARED_STAGE: ThemeStage = { readout: 'bar', wrongMark: null, scoreBars: false, masthead: false, rows: false };

const STAGES: Partial<Record<Theme, Partial<ThemeStage>>> = {
  'tokyo-rain': { readout: 'segments', wrongMark: 'Sold out' },
  konbini: { readout: 'segments', wrongMark: 'Sold out' },
  karaoke: { readout: 'lyric', rows: true },
  omikuji: { readout: 'shide' },
  'blossom-map': { readout: 'route' },
  'tournament-arc': { readout: 'pennants' },
  'splash-page': { readout: 'focus' },
  'night-arc': { readout: 'focus' },
  'side-a': { readout: 'reels', rows: true },
  sakura: { readout: 'dango' },
  shonen: { readout: 'digits', scoreBars: true },
  mecha: { readout: 'nipper', wrongMark: 'Spare' },
  'magical-girl': { readout: 'dial' },
  isekai: { readout: 'candle' },
  'retro-vhs': { readout: 'ruler', masthead: true },
};

export function stageOf(theme: Theme): ThemeStage {
  return { ...SHARED_STAGE, ...STAGES[theme] };
}

// The player's theme, for the screens that lay out a stage. App provides it from the prefs.
export const ThemeContext = createContext<Theme>('tokyo-rain');

export function useStage(): ThemeStage {
  return stageOf(useContext(ThemeContext));
}

// The options' grid columns for the player's theme: one column of rows, or 2x2.
export function useOptionColumns(): string {
  return useStage().rows ? 'grid-cols-1' : 'grid-cols-2';
}
