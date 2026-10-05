// The theme's backdrop behind every screen: its texture, and when motion is on, its weather: rain over Tokyo,
// falling petals for Hanami, twinkling lights in the karaoke box, a tracking band on the tape, speed lines on
// Fighter Select's page; the worlds indoors or in the sun keep still. The weather
// follows the game's phase (data-phase on the page, set by usePagePhase): a second layer of it surges in while
// the clip plays, and a flash marks the reveal and the results. It never follows the audio, so it can't give a
// song away. Decoration only: hidden from assistive technology, never in the way of a tap.
import type { CSSProperties } from 'react';
import type { Theme } from '../prefs/prefs.ts';

interface Mote {
  left: number; // percent of the width
  top: number; // percent of the height, for motes that stay put
  delay: number; // seconds
  duration: number; // seconds
  size: number; // px
}

// Spread out by fixed steps rather than at random, so every render and every device draws the same scene. The
// surge layer starts further along the sequence, so its motes fall between the calm layer's.
function motes(count: number, duration: [number, number], size: [number, number], offset = 0): Mote[] {
  return Array.from({ length: count }, (_, step) => {
    const index = step + offset;
    return {
      left: (index * 37 + 11) % 100,
      top: (index * 61 + 7) % 100,
      delay: (-((index * 53) % 97) / 97) * duration[1],
      duration: duration[0] + (((index * 29) % 11) / 10) * (duration[1] - duration[0]),
      size: size[0] + (((index * 17) % 7) / 6) * (size[1] - size[0]),
    };
  });
}

type Falling = 'rain' | 'petal';
type Staying = 'twinkle';
type Sweeping = 'tracking' | 'speed-lines';
type Weather = Falling | Staying | Sweeping;

const TIMING: Record<Falling | Staying, { duration: [number, number]; size: [number, number] }> = {
  rain: { duration: [0.6, 1.3], size: [48, 120] },
  petal: { duration: [9, 16], size: [11, 22] },
  twinkle: { duration: [2.4, 4.8], size: [8, 20] },
};

interface Sky {
  calm: { kind: Weather; count: number } | null;
  surge: { kind: Weather; count: number } | null;
}

const SKIES: Record<Theme, Sky> = {
  'tokyo-rain': { calm: { kind: 'rain', count: 34 }, surge: { kind: 'rain', count: 30 } },
  konbini: { calm: { kind: 'rain', count: 24 }, surge: { kind: 'rain', count: 24 } },
  karaoke: { calm: { kind: 'twinkle', count: 14 }, surge: { kind: 'twinkle', count: 18 } },
  sakura: { calm: { kind: 'petal', count: 18 }, surge: { kind: 'petal', count: 16 } },
  omikuji: { calm: { kind: 'petal', count: 10 }, surge: { kind: 'petal', count: 10 } },
  'blossom-map': { calm: { kind: 'petal', count: 12 }, surge: { kind: 'petal', count: 12 } },
  shonen: { calm: null, surge: { kind: 'speed-lines', count: 1 } },
  'tournament-arc': { calm: null, surge: { kind: 'speed-lines', count: 1 } },
  'splash-page': { calm: null, surge: { kind: 'speed-lines', count: 1 } },
  'night-arc': { calm: null, surge: { kind: 'speed-lines', count: 1 } },
  mecha: { calm: null, surge: null },
  'magical-girl': { calm: null, surge: null },
  isekai: { calm: null, surge: null },
  'retro-vhs': { calm: null, surge: null },
  'side-a': { calm: { kind: 'tracking', count: 1 }, surge: { kind: 'tracking', count: 1 } },
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

function Layer({ kind, count, offset }: { kind: Weather; count: number; offset: number }) {
  if (kind === 'tracking' || kind === 'speed-lines') return <span className={kind} />;
  const { duration, size } = TIMING[kind];
  const scene = motes(count, duration, size, offset);
  if (kind === 'rain' || kind === 'petal') {
    return scene.map((mote, index) => (
      <span key={index} className={kind === 'rain' ? 'rain-drop' : 'petal'} style={fallingStyle(mote, kind)} />
    ));
  }
  return scene.map((mote, index) => <span key={index} className={kind} style={stayingStyle(mote)} />);
}

export function Backdrop({ theme, reducedMotion }: { theme: Theme; reducedMotion: boolean }) {
  const { calm, surge } = SKIES[theme];
  return (
    <div aria-hidden="true" className="page-texture pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span className="backdrop-plate" />
      {!reducedMotion && (
        <>
          {calm && <Layer kind={calm.kind} count={calm.count} offset={0} />}
          {surge && (
            <span className="weather-surge">
              <Layer kind={surge.kind} count={surge.count} offset={(calm?.count ?? 0) + 5} />
            </span>
          )}
          <span className="phase-flash" />
        </>
      )}
    </div>
  );
}
