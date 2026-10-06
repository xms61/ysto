// Each player's animal (docs/product-specs/lobby.md), drawn for this game in two inks: the stamp's ink and its
// paper, the same in every theme, so a pick reads as that player's stamp on any world's cards.
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { PlayerIcon as Icon } from '../../shared/protocol.ts';

export const ICON_NAMES: Record<Icon, string> = {
  fox: 'Fox',
  cat: 'Cat',
  owl: 'Owl',
  frog: 'Frog',
  panda: 'Panda',
  rabbit: 'Rabbit',
  bear: 'Bear',
  penguin: 'Penguin',
  tanuki: 'Tanuki',
  octopus: 'Octopus',
  crane: 'Crane',
  koi: 'Koi',
  dog: 'Dog',
  turtle: 'Turtle',
  hamster: 'Hamster',
  chick: 'Chick',
};

// Two paper eyes with ink pupils, for the faces that look straight out.
function Eyes({ y, apart, size = 1.6 }: { y: number; apart: number; size?: number }) {
  return (
    <>
      <circle cx={16 - apart} cy={y} r={size + 0.9} className="pi-paper" />
      <circle cx={16 + apart} cy={y} r={size + 0.9} className="pi-paper" />
      <circle cx={16 - apart} cy={y} r={size} />
      <circle cx={16 + apart} cy={y} r={size} />
    </>
  );
}

const ART: Record<Icon, ReactNode> = {
  fox: (
    <>
      <path d="M4 5 L12 11 H20 L28 5 L26 17 Q16 30 6 17 Z" />
      <path d="M9 18 Q16 26 23 18 Q16 21 9 18 Z" className="pi-paper" />
      <circle cx="12" cy="15" r="1.4" className="pi-paper" />
      <circle cx="20" cy="15" r="1.4" className="pi-paper" />
      <circle cx="16" cy="22.5" r="1.3" />
    </>
  ),
  cat: (
    <>
      <path d="M6 6 L12 11 H20 L26 6 L26.5 16 Q26.5 27 16 27 Q5.5 27 5.5 16 Z" />
      <circle cx="12" cy="17" r="1.6" className="pi-paper" />
      <circle cx="20" cy="17" r="1.6" className="pi-paper" />
      <path d="M14.5 21 H17.5 L16 22.6 Z" className="pi-paper" />
      <path d="M3 19 H9 M3 22 L9 21 M29 19 H23 M29 22 L23 21" className="pi-line pi-ink-line" strokeWidth="1.2" />
    </>
  ),
  owl: (
    <>
      <path d="M7 6 L11 10 H21 L25 6 L26 20 Q26 29 16 29 Q6 29 6 20 Z" />
      <Eyes y={15} apart={4.6} size={2.2} />
      <path d="M14.5 19 L17.5 19 L16 22.5 Z" className="pi-paper" />
    </>
  ),
  frog: (
    <>
      <circle cx="10" cy="10" r="5" />
      <circle cx="22" cy="10" r="5" />
      <ellipse cx="16" cy="19.5" rx="12.5" ry="8.5" />
      <Eyes y={10} apart={6} size={1.8} />
      <path d="M9 21 Q16 26 23 21" className="pi-line pi-paper-line" strokeWidth="1.6" />
    </>
  ),
  panda: (
    <>
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="24" cy="8" r="4.5" />
      <circle cx="16" cy="17" r="11.5" />
      <circle cx="16" cy="17" r="9.5" className="pi-paper" />
      <ellipse cx="11.6" cy="16" rx="2.8" ry="3.6" transform="rotate(25 11.6 16)" />
      <ellipse cx="20.4" cy="16" rx="2.8" ry="3.6" transform="rotate(-25 20.4 16)" />
      <ellipse cx="16" cy="21.5" rx="2" ry="1.4" />
    </>
  ),
  rabbit: (
    <>
      <ellipse cx="11" cy="9" rx="3.2" ry="8" transform="rotate(-10 11 9)" />
      <ellipse cx="21" cy="9" rx="3.2" ry="8" transform="rotate(10 21 9)" />
      <circle cx="16" cy="20" r="9" />
      <circle cx="12.5" cy="19" r="1.5" className="pi-paper" />
      <circle cx="19.5" cy="19" r="1.5" className="pi-paper" />
      <ellipse cx="16" cy="23.5" rx="2.2" ry="1.4" className="pi-paper" />
    </>
  ),
  bear: (
    <>
      <circle cx="8" cy="9" r="4.5" />
      <circle cx="24" cy="9" r="4.5" />
      <circle cx="16" cy="18" r="11" />
      <circle cx="11.8" cy="16" r="1.5" className="pi-paper" />
      <circle cx="20.2" cy="16" r="1.5" className="pi-paper" />
      <ellipse cx="16" cy="22" rx="4.6" ry="3.6" className="pi-paper" />
      <ellipse cx="16" cy="20.8" rx="1.8" ry="1.2" />
    </>
  ),
  penguin: (
    <>
      <ellipse cx="16" cy="17" rx="11" ry="12.5" />
      <path d="M16 9 Q7 9 8 19 Q9 27 16 28 Q23 27 24 19 Q25 9 16 9 Q17 13 16 14 Q15 13 16 9 Z" className="pi-paper" />
      <circle cx="12.5" cy="16" r="1.5" />
      <circle cx="19.5" cy="16" r="1.5" />
      <path d="M13.5 19.5 H18.5 L16 22.5 Z" />
    </>
  ),
  tanuki: (
    <>
      <circle cx="8" cy="8" r="4" />
      <circle cx="24" cy="8" r="4" />
      <path d="M4 15 Q4 6 16 6 Q28 6 28 15 Q28 28 16 28 Q4 28 4 15 Z" className="pi-paper" />
      <path d="M4 15 Q4 6 16 6 Q28 6 28 15 Q28 28 16 28 Q4 28 4 15 Z" className="pi-line pi-ink-line" strokeWidth="2" />
      <path d="M5 16 Q9 11 14 15 L16 17 L18 15 Q23 11 27 16 Q23 21 18 19 L16 20 L14 19 Q9 21 5 16 Z" />
      <circle cx="10.5" cy="16" r="1.4" className="pi-paper" />
      <circle cx="21.5" cy="16" r="1.4" className="pi-paper" />
      <ellipse cx="16" cy="23" rx="2" ry="1.4" />
    </>
  ),
  octopus: (
    <>
      <path d="M6 16 Q6 4 16 4 Q26 4 26 16 L26 18 H6 Z" />
      <path
        d="M7 17 Q5 24 8 27 M11.5 18 Q10.5 25 13 28 M16 18 V28.5 M20.5 18 Q21.5 25 19 28 M25 17 Q27 24 24 27"
        className="pi-line pi-ink-line"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <Eyes y={12} apart={4} size={1.7} />
    </>
  ),
  crane: (
    <>
      <path d="M9 29 Q8 20 13 15 Q16 12 15 8 Q15 4 19 4 Q22 4 23 7 L29 9 L22.5 10.5 Q20 12 20 16 Q19 22 15 29 Z" />
      <circle cx="19.6" cy="5.6" r="2.2" className="pi-crest" />
      <circle cx="20.2" cy="7.4" r="1" className="pi-paper" />
    </>
  ),
  koi: (
    <>
      <path d="M3 16 Q9 7 18 9 Q24 10 26 16 Q24 22 18 23 Q9 25 3 16 Z" />
      <path d="M25 16 L30 10 L29 16 L30 22 Z" />
      <path d="M11 11.5 Q15 14 13 19 Q17 17 18.5 12" className="pi-paper" />
      <circle cx="7.6" cy="15" r="1.4" className="pi-paper" />
    </>
  ),
  dog: (
    <>
      <path d="M5 5 L12 10 H20 L27 5 L27 17 Q27 28 16 28 Q5 28 5 17 Z" />
      <path d="M9 19 Q9 15 13 15 L16 17 L19 15 Q23 15 23 19 Q23 26 16 26 Q9 26 9 19 Z" className="pi-paper" />
      <circle cx="11.5" cy="13" r="1.5" className="pi-paper" />
      <circle cx="20.5" cy="13" r="1.5" className="pi-paper" />
      <ellipse cx="16" cy="19.5" rx="2.2" ry="1.5" />
    </>
  ),
  turtle: (
    <>
      <circle cx="26" cy="17" r="3.5" />
      <path d="M4 21 Q4 9 15 9 Q25 9 25 21 Z" />
      <path d="M9 21 L8 26 H12 L12.5 21 M18 21 L18.5 26 H22.5 L21 21" />
      <path d="M10 20 L12 14 H18 L20 20 M15 9.5 V14" className="pi-line pi-paper-line" strokeWidth="1.3" />
      <circle cx="27" cy="16" r="0.9" className="pi-paper" />
    </>
  ),
  hamster: (
    <>
      <circle cx="9" cy="9" r="3.5" />
      <circle cx="23" cy="9" r="3.5" />
      <ellipse cx="16" cy="18.5" rx="12" ry="10" />
      <ellipse cx="9" cy="21" rx="3.4" ry="2.6" className="pi-paper" />
      <ellipse cx="23" cy="21" rx="3.4" ry="2.6" className="pi-paper" />
      <circle cx="12" cy="16" r="1.5" className="pi-paper" />
      <circle cx="20" cy="16" r="1.5" className="pi-paper" />
      <path d="M14.6 19.5 H17.4 L16 21 Z" className="pi-paper" />
    </>
  ),
  chick: (
    <>
      <path d="M14 7 Q13 3 16 3 Q15.5 5 17 6 Q19 3 20 6" className="pi-line pi-ink-line" strokeWidth="1.8" />
      <circle cx="16" cy="18" r="11" />
      <circle cx="12" cy="16" r="1.6" className="pi-paper" />
      <circle cx="20" cy="16" r="1.6" className="pi-paper" />
      <path d="M13 20 H19 L16 23.5 Z" className="pi-paper" />
    </>
  ),
};

// The animal on its own, in the stamp's two inks.
export function PlayerIcon({ icon, className = '' }: { icon: Icon; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`player-icon ${className}`}>
      {ART[icon]}
    </svg>
  );
}

// A pick at the reveal, pressed onto the card like a rubber stamp: a ring and the animal in one color, the
// world's stamp ink, its paper parts cut out so the card shows through. This player's own has a second ring.
export function PlayerStamp({ icon, you = false }: { icon: Icon; you?: boolean }) {
  const mask = `stamp-${useId().replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="player-stamp">
      <mask id={mask}>
        <g className="pi-cut" transform="translate(8 8) scale(0.75)">
          {ART[icon]}
        </g>
      </mask>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {you && <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="1.25" />}
      <rect width="40" height="40" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}

// The animal on its round paper stamp, ringed in the theme's accent for this player's own.
export function PlayerBadge({ icon, you = false }: { icon: Icon; you?: boolean }) {
  return (
    <span className="player-badge" data-you={you || undefined}>
      <PlayerIcon icon={icon} />
    </span>
  );
}
