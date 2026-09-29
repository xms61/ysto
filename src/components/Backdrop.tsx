// The theme's backdrop behind every screen: its texture, and when motion is on, rain for Tokyo Rain or
// petals for Sakura. It is decoration only, hidden from assistive technology, and never catches a tap.
import type { CSSProperties } from 'react';
import type { Theme } from '../prefs/prefs.ts';

interface Fall {
  left: number; // percent of the width
  delay: number; // seconds
  duration: number; // seconds
  size: number; // px
}

// Spread out by fixed steps rather than at random, so every render and every device draws the same scene.
function falls(count: number, duration: [number, number], size: [number, number]): Fall[] {
  return Array.from({ length: count }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    delay: (-((index * 53) % 97) / 97) * duration[1],
    duration: duration[0] + (((index * 29) % 11) / 10) * (duration[1] - duration[0]),
    size: size[0] + (((index * 17) % 7) / 6) * (size[1] - size[0]),
  }));
}

const RAIN = falls(28, [0.6, 1.3], [48, 110]);
const PETALS = falls(12, [9, 16], [9, 16]);

function styleOf(fall: Fall, kind: 'rain' | 'petal'): CSSProperties {
  const size = kind === 'rain' ? { height: `${fall.size}px` } : { width: `${fall.size}px`, height: `${fall.size}px` };
  return { left: `${fall.left}%`, animationDelay: `${fall.delay}s`, animationDuration: `${fall.duration}s`, ...size };
}

export function Backdrop({ theme, reducedMotion }: { theme: Theme; reducedMotion: boolean }) {
  const kind = theme === 'tokyo-rain' ? 'rain' : theme === 'sakura' ? 'petal' : null;
  return (
    <div aria-hidden="true" className="page-texture pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {kind &&
        !reducedMotion &&
        (kind === 'rain' ? RAIN : PETALS).map((fall, index) => (
          <span key={index} className={kind === 'rain' ? 'rain-drop' : 'petal'} style={styleOf(fall, kind)} />
        ))}
    </div>
  );
}
