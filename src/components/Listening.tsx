// Whether this player can hear the round: the clip loading, playing, or failed to load. It tells "I can't hear
// it" apart from "I don't know it", and fills the stage above the cards with the one thing the game is about,
// the music. The bars move only while the clip plays and motion is on; they are decoration, the words are not.
import type { ClipStatus } from '../realtime/store.ts';

// A resting skyline for the bars, fixed so every device draws the same one. A phone shows the first 14.
const HEIGHTS = [42, 70, 55, 92, 64, 36, 82, 50, 76, 46, 60, 32, 68, 88, 58, 40, 74, 52, 86, 44, 66, 38, 80, 56];

function wordsFor(status: ClipStatus | null, playing: boolean): string {
  if (status === 'failed') return "Your clip didn't load. You can still answer, with no penalty.";
  if (status !== 'ready') return 'Loading the clip…';
  return playing ? 'Listen.' : 'The clip is ready.';
}

export function Listening({ status, playing }: { status: ClipStatus | null; playing: boolean }) {
  return (
    <div className="listening" data-status={status ?? 'loading'} data-playing={playing || undefined}>
      <div aria-hidden="true" className="eq">
        {HEIGHTS.map((height, index) => (
          <span key={index} className="eq-bar">
            <span
              className="eq-fill"
              style={{ height: `${height}%`, animationDelay: `${-((index * 7) % 11) / 10}s` }}
            />
          </span>
        ))}
      </div>
      <p role="status" className="text-sm text-muted">
        {wordsFor(status, playing)}
      </p>
    </div>
  );
}
