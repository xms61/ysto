// The theme's backdrop behind every screen: its texture, and when motion is on, its weather: rain over Tokyo,
// falling petals for Sakura, a scanner sweep in the hangar, twinkling stars for Magical Girl, blinking pixel
// stars for Isekai, a tracking band on the tape. Decoration only: hidden from assistive technology, never in
// the way of a tap. Shonen's page holds still, like the printed page it is.
import type { CSSProperties } from 'react';
import type { Theme } from '../prefs/prefs.ts';

interface Mote {
  left: number; // percent of the width
  top: number; // percent of the height, for motes that stay put
  delay: number; // seconds
  duration: number; // seconds
  size: number; // px
}

// Spread out by fixed steps rather than at random, so every render and every device draws the same scene.
function motes(count: number, duration: [number, number], size: [number, number]): Mote[] {
  return Array.from({ length: count }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    top: (index * 61 + 7) % 100,
    delay: (-((index * 53) % 97) / 97) * duration[1],
    duration: duration[0] + (((index * 29) % 11) / 10) * (duration[1] - duration[0]),
    size: size[0] + (((index * 17) % 7) / 6) * (size[1] - size[0]),
  }));
}

const FALLING = {
  rain: motes(28, [0.6, 1.3], [48, 110]),
  petal: motes(12, [9, 16], [9, 16]),
};
const STAYING = {
  twinkle: motes(14, [2.4, 4.8], [7, 15]),
  'pixel-star': motes(18, [0.9, 2.2], [3, 3]),
};

type Falling = keyof typeof FALLING;
type Staying = keyof typeof STAYING;

const WEATHER: Record<Theme, Falling | Staying | 'sweep' | 'tracking' | null> = {
  'tokyo-rain': 'rain',
  sakura: 'petal',
  shonen: null,
  mecha: 'sweep',
  'magical-girl': 'twinkle',
  isekai: 'pixel-star',
  'retro-vhs': 'tracking',
};

function fallingStyle(mote: Mote, kind: Falling): CSSProperties {
  const size = kind === 'rain' ? { height: `${mote.size}px` } : { width: `${mote.size}px`, height: `${mote.size}px` };
  return { left: `${mote.left}%`, animationDelay: `${mote.delay}s`, animationDuration: `${mote.duration}s`, ...size };
}

function stayingStyle(mote: Mote): CSSProperties {
  return {
    left: `${mote.left}%`,
    top: `${mote.top}%`,
    width: `${mote.size}px`,
    height: `${mote.size}px`,
    animationDelay: `${mote.delay}s`,
    animationDuration: `${mote.duration}s`,
  };
}

function Weather({ kind }: { kind: Falling | Staying | 'sweep' | 'tracking' }) {
  if (kind === 'sweep' || kind === 'tracking') return <span className={kind} />;
  if (kind === 'rain' || kind === 'petal') {
    return FALLING[kind].map((mote, index) => (
      <span key={index} className={kind === 'rain' ? 'rain-drop' : 'petal'} style={fallingStyle(mote, kind)} />
    ));
  }
  return STAYING[kind].map((mote, index) => <span key={index} className={kind} style={stayingStyle(mote)} />);
}

export function Backdrop({ theme, reducedMotion }: { theme: Theme; reducedMotion: boolean }) {
  const kind = WEATHER[theme];
  return (
    <div aria-hidden="true" className="page-texture pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {kind && !reducedMotion && <Weather kind={kind} />}
    </div>
  );
}
