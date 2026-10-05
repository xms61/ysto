// The time left as a shrine's straw rope across the row with eight zigzag paper streamers hanging from it, taken
// one at a time from the right as the round runs down; with motion on, the streamers sway while the clip plays
// and each one falls as it goes. Decoration only; the caller gives screen readers the seconds in words.

const STREAMERS = 8;
const SPACING = 30;
// One streamer: four paper steps, each set a little to the side of the one above, folded down from the rope.
const ZIGZAG = '0,0 8,0 8,9 13,9 13,18 8,18 8,27 13,27 13,36 5,36 5,27 0,27 0,18 5,18 5,9 0,9';

// left: the share of the round still to run, 0 to 1. A streamer stays until its whole share is gone.
export function Shide({ left }: { left: number }) {
  const kept = Math.ceil(Math.min(1, Math.max(0, left)) * STREAMERS);
  const width = STREAMERS * SPACING + 8;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} 48`} className="shide">
      <line x1="3" y1="6" x2={width - 3} y2="6" className="shide-rope" />
      <line x1="3" y1="6" x2={width - 3} y2="6" className="shide-twist" />
      {Array.from({ length: STREAMERS }, (_, at) => (
        <g key={at} transform={`translate(${12 + at * SPACING} 8)`}>
          <polygon points={ZIGZAG} className="shide-paper" data-gone={at >= kept || undefined} />
        </g>
      ))}
    </svg>
  );
}
