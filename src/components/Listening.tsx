// Whether this player can hear the round: the clip loading, playing, or failed to load. It tells "I can't hear
// it" apart from "I don't know it", and fills the stage above the cards with the one thing the game is about,
// the music: a pair of headphones that sends out rings across the round's panel while the clip plays. The rings
// move only while the clip plays and motion is on; they are decoration, the words are not.
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { ClipStatus } from '../realtime/store.ts';

function wordsFor(status: ClipStatus | null, playing: boolean): string {
  if (status === 'failed') return "Your clip didn't load. You can still answer, with no penalty.";
  if (status !== 'ready') return 'Loading the clip…';
  return playing ? 'Listen.' : 'The clip is ready.';
}

// The rings live in a layer over the whole panel, behind its content. They start on the headphones, and grow
// until they reach the panel's farthest corner, so each one sweeps the panel edge to edge.
function useRingField(core: RefObject<HTMLElement | null>, field: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const icon = core.current;
    const layer = field.current;
    const panel = icon?.closest('.panel');
    if (!icon || !layer || !panel) return;
    const measure = () => {
      const box = panel.getBoundingClientRect();
      const at = icon.getBoundingClientRect();
      const x = at.left + at.width / 2 - box.left - panel.clientLeft;
      const y = at.top + at.height / 2 - box.top - panel.clientTop;
      const reach = 2 * Math.hypot(Math.max(x, panel.clientWidth - x), Math.max(y, panel.clientHeight - y));
      layer.style.setProperty('--ring-x', `${x}px`);
      layer.style.setProperty('--ring-y', `${y}px`);
      layer.style.setProperty('--ring-reach', `${Math.ceil(reach)}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [core, field]);
}

// Over-ear headphones, drawn so their bounds center on the box: a band arching over two cushioned cups.
function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 13.5 V11.5 a7 7 0 0 1 14 0 V13.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="12" width="5.5" height="8.5" rx="2.5" />
      <rect x="15.5" y="12" width="5.5" height="8.5" rx="2.5" />
      <rect x="6.5" y="13.5" width="1" height="5.5" rx="0.5" fill="var(--panel)" />
      <rect x="16.5" y="13.5" width="1" height="5.5" rx="0.5" fill="var(--panel)" />
    </svg>
  );
}

export function Listening({ status, playing }: { status: ClipStatus | null; playing: boolean }) {
  const core = useRef<HTMLSpanElement>(null);
  const field = useRef<HTMLSpanElement>(null);
  useRingField(core, field);
  // While the clip plays the rings say it, so "Listen." is left to screen readers.
  const heard = status === 'ready' && playing;
  return (
    <div className="listening" data-status={status ?? 'loading'} data-playing={playing || undefined}>
      <div aria-hidden="true" className="sonar">
        <span ref={field} className="sonar-field">
          <span className="sonar-ring" />
          <span className="sonar-ring" />
          <span className="sonar-ring" />
        </span>
        <span ref={core} className="sonar-core">
          <HeadphonesIcon />
        </span>
      </div>
      <p role="status" className={heard ? 'sr-only' : 'text-sm text-muted'}>
        {wordsFor(status, playing)}
      </p>
    </div>
  );
}
