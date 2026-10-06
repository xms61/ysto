// Which sound effects a change in the game calls for (sounds.ts): the deal when a round's cards come in, a pick
// when this player picks, the overtime's call when it starts, right or wrong at the reveal (a missed round sounds
// wrong, a skipped one plays nothing), and the results when the game ends. Nothing plays for the state a page
// loads into, only for what changes after it.
import { useEffect, useRef } from 'react';
import type { GameState } from '../realtime/game-state.ts';
import type { AudioEngine } from './engine.ts';
import { CUE_DELAY_S, SOUNDS } from './sounds.ts';
import type { Cue } from './sounds.ts';
import type { Theme } from '../prefs/prefs.ts';

function roundCues(before: GameState, after: GameState): Cue[] {
  const round = after.round;
  if (!round) return [];
  const previous = before.round?.id === round.id ? before.round : null;
  if (!previous) return ['deal'];
  const cues: Cue[] = [];
  if (round.choice !== null && round.choice !== previous.choice) cues.push('pick');
  if (round.overtime && !previous.overtime) cues.push('overtime');
  if (round.reveal && !previous.reveal && !round.reveal.skipped) {
    cues.push(round.choice === round.reveal.correct ? 'right' : 'wrong');
  }
  return cues;
}

export function cuesBetween(before: GameState, after: GameState): Cue[] {
  if (!before.lobby) return [];
  const ended = after.lobby?.game?.phase === 'results' && before.lobby.game?.phase !== 'results';
  return [...roundCues(before, after), ...(ended ? (['results'] as const) : [])];
}

export function useSoundCues(game: GameState, audio: AudioEngine, theme: Theme, on: boolean): void {
  const shown = useRef(game);
  useEffect(() => {
    const before = shown.current;
    shown.current = game;
    if (!on) return;
    for (const cue of cuesBetween(before, game)) audio.playTones(SOUNDS[theme][cue], CUE_DELAY_S[cue]);
  }, [game, audio, theme, on]);
}
