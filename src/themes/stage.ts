// What a theme's world changes in the round beyond its stock (docs/DESIGN.md#theme-worlds): how the time left
// reads, the mark printed on an option that was not the answer, and whether the results draw each score as a
// bar. A theme that sets nothing plays the shared round. The stage never changes what the four options are or when they show, only how they are drawn.
import { createContext, useContext } from 'react';
import type { Theme } from '../prefs/prefs.ts';

export interface ThemeStage {
  // The shared bar, a seven-segment display, a dango skewer eaten down, the seconds as huge arcade digits, a
  // nipper cutting along a runner, a gachapon's coin dial turning, or a candle burning down.
  readout: 'bar' | 'segments' | 'dango' | 'digits' | 'nipper' | 'dial' | 'candle';
  wrongMark: string | null; // printed on each option that was not the answer, at the reveal
  scoreBars: boolean; // each final score also drawn as a bar against the winner's, like a health bar
}

const SHARED_STAGE: ThemeStage = { readout: 'bar', wrongMark: null, scoreBars: false };

const STAGES: Partial<Record<Theme, Partial<ThemeStage>>> = {
  'tokyo-rain': { readout: 'segments', wrongMark: 'Sold out' },
  sakura: { readout: 'dango' },
  shonen: { readout: 'digits', scoreBars: true },
  mecha: { readout: 'nipper', wrongMark: 'Spare' },
  'magical-girl': { readout: 'dial' },
  isekai: { readout: 'candle' },
};

export function stageOf(theme: Theme): ThemeStage {
  return { ...SHARED_STAGE, ...STAGES[theme] };
}

// The player's theme, for the screens that lay out a stage. App provides it from the prefs.
export const ThemeContext = createContext<Theme>('tokyo-rain');

export function useStage(): ThemeStage {
  return stageOf(useContext(ThemeContext));
}
