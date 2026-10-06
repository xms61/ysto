import { expect, test } from 'vitest';
import { THEMES } from '../prefs/prefs.ts';
import { CUES, SOUNDS } from './sounds.ts';

test.each(THEMES)('%s has a short, audible sound for every cue', (theme) => {
  for (const cue of CUES) {
    const tones = SOUNDS[theme][cue];
    expect(tones.length, `${theme} ${cue}`).toBeGreaterThan(0);
    for (const tone of tones) {
      expect(tone.from, `${theme} ${cue}`).toBeGreaterThanOrEqual(40);
      expect(tone.from, `${theme} ${cue}`).toBeLessThanOrEqual(8000);
      expect(tone.level, `${theme} ${cue}`).toBeGreaterThan(0);
      expect(tone.level, `${theme} ${cue}`).toBeLessThanOrEqual(1);
      expect(tone.at + tone.length, `${theme} ${cue} ends within 2.5 s`).toBeLessThanOrEqual(2.5);
    }
  }
});
