// A burst of the theme's own material from the middle of its parent: petals for Sakura, foil sparkles for
// Magical Girl, pixels for Isekai, and so on (styles.css prints each mote). It marks a moment that has
// already happened, the right answer or the winner, so it is decoration only: hidden from assistive
// technology, never in the way of a tap, and drawn only while motion is full.
import type { CSSProperties } from 'react';

interface BurstProps {
  count: number;
  reach: number; // rem from the middle to the farthest mote
  delayMs?: number;
}

const GOLDEN_ANGLE = 2.39996;

// Spread by the golden angle rather than at random, so every device draws the same burst.
function moteStyle(index: number, count: number, reach: number, delayMs: number): CSSProperties {
  const angle = index * GOLDEN_ANGLE;
  const distance = reach * (0.45 + 0.55 * (((index * 37) % count) / count));
  return {
    '--dx': `${(Math.cos(angle) * distance).toFixed(2)}rem`,
    '--dy': `${(Math.sin(angle) * distance).toFixed(2)}rem`,
    '--spin': `${((index * 97) % 360) - 180}deg`,
    '--size': `${0.45 + ((index * 13) % 5) * 0.12}rem`,
    animationDelay: `${delayMs + ((index * 23) % 7) * 18}ms`,
  } as CSSProperties;
}

export function Burst({ count, reach, delayMs = 0 }: BurstProps) {
  return (
    <span aria-hidden="true" className="burst">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="burst-mote" style={moteStyle(index, count, reach, delayMs)} />
      ))}
    </span>
  );
}
