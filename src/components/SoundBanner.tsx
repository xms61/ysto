// Tells the player when they won't hear the clips: before their first tap after a reload, after an iPhone
// suspends audio, or when the browser has no Web Audio at all. Answering still works in every case.
import { useSyncExternalStore } from 'react';
import type { AudioEngine } from '../audio/engine.ts';
import { Button } from './ui.tsx';

export function SoundBanner({ audio }: { audio: AudioEngine }) {
  const state = useSyncExternalStore(audio.subscribe, audio.getState);
  if (state === 'running') return null;
  if (state === 'unavailable') {
    return (
      <p role="status" className="rounded-lg border border-line bg-raised p-3">
        This browser can&apos;t play the clips. You can still answer.
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-raised p-3">
      <span>Sound is off until you tap here.</span>
      <Button onClick={() => audio.unlock()}>Turn on sound</Button>
    </div>
  );
}
