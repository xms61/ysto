// What a theme's world changes in the round beyond its stock (docs/DESIGN.md#theme-worlds): how the time left
// reads, and the mark printed on an option that was not the answer. A theme that sets nothing plays the shared
// round. The stage never changes what the four options are or when they show, only how they are drawn.
import { createContext, useContext } from 'react';
import type { Theme } from '../prefs/prefs.ts';

export interface ThemeStage {
  readout: 'bar' | 'segments'; // the shared timer bar, or a seven-segment display of the seconds left
  wrongMark: string | null; // printed on each option that was not the answer, at the reveal
}

const SHARED_STAGE: ThemeStage = { readout: 'bar', wrongMark: null };

const STAGES: Partial<Record<Theme, Partial<ThemeStage>>> = {
  'tokyo-rain': { readout: 'segments', wrongMark: 'Sold out' },
};

export function stageOf(theme: Theme): ThemeStage {
  return { ...SHARED_STAGE, ...STAGES[theme] };
}

// The player's theme, for the screens that lay out a stage. App provides it from the prefs.
export const ThemeContext = createContext<Theme>('tokyo-rain');

export function useStage(): ThemeStage {
  return stageOf(useContext(ThemeContext));
}
