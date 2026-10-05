// The time left as Side A of a cassette playing: the tape winds off the left reel onto the right one as the round
// runs down, so the left pack is what is still to play; with motion on, both reels turn while the clip plays.
// Decoration only; the caller gives screen readers the seconds in words.

const HUB = 5;
const PACK = 11; // the most tape a reel holds beyond its hub
const SPOKES = [0, 60, 120, 180, 240, 300];

function Reel({ x, pack }: { x: number; pack: number }) {
  return (
    <g transform={`translate(${x} 40)`}>
      <circle r={HUB + pack} className="cassette-tape" />
      <g className="cassette-hub">
        <circle r={HUB} className="cassette-hub-ring" />
        {SPOKES.map((angle) => (
          <rect key={angle} x="-0.75" y={-HUB} width="1.5" height="2.5" transform={`rotate(${angle})`} />
        ))}
      </g>
    </g>
  );
}

// left: the share of the round still to run, 0 to 1.
export function Cassette({ left }: { left: number }) {
  const share = Math.min(1, Math.max(0, left));
  return (
    <svg aria-hidden="true" viewBox="0 0 120 76" className="cassette">
      <rect x="2" y="2" width="116" height="72" rx="6" className="cassette-shell" />
      <rect x="10" y="8" width="100" height="20" rx="2" className="cassette-label" />
      <rect x="10" y="12" width="100" height="3" className="cassette-stripe" />
      <rect x="26" y="29" width="68" height="22" rx="11" className="cassette-window" />
      <Reel x={40} pack={PACK * share} />
      <Reel x={80} pack={PACK * (1 - share)} />
      <path d="M30 74 L36 60 H84 L90 74" className="cassette-foot" />
    </svg>
  );
}
