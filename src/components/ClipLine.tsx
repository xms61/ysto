// Whether this player can hear the round: the clip loading, playing, or failed to load. It tells "I can't hear
// it" apart from "I don't know it". It shows only while the clip loads or when it failed; a ready clip is
// said to screen readers only.
import type { ClipStatus } from '../realtime/store.ts';

function wordsFor(status: ClipStatus | null, playing: boolean): string {
  if (status === 'failed') return "Your clip didn't load. You can still answer, with no penalty.";
  if (status !== 'ready') return 'Loading the clip…';
  return playing ? 'Listen.' : 'The clip is ready.';
}

export function ClipLine({ status, playing }: { status: ClipStatus | null; playing: boolean }) {
  return (
    <p
      role="status"
      className={status === 'ready' ? 'sr-only' : 'clip-line text-sm text-muted'}
      data-status={status ?? 'loading'}
    >
      {wordsFor(status, playing)}
    </p>
  );
}
