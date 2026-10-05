// The time left as a nipper working along the runner's frame: the frame is held by fourteen gates, and the nipper
// cuts one gate at a time from the left as the round runs down, so the cut gaps show what is gone; with motion
// on, its jaws snap shut at each cut. Decoration only; the caller gives screen readers the seconds in words.

const GATES = 14;
const SPAN = 26;
const LEFT = 6;

// left: the share of the round still to run, 0 to 1. A gate holds until its whole share is cut.
export function Nipper({ left }: { left: number }) {
  const kept = Math.ceil(Math.min(1, Math.max(0, left)) * GATES);
  const cut = GATES - kept;
  const width = LEFT * 2 + GATES * SPAN;
  const at = LEFT + Math.min(cut, GATES - 1) * SPAN + SPAN / 2;
  return (
    <svg aria-hidden="true" viewBox={`0 -8 ${width} 48`} className="nipper">
      {Array.from({ length: GATES }, (_, gate) => (
        <g key={gate} data-cut={gate < cut || undefined}>
          <rect x={LEFT + gate * SPAN} y="29" width={SPAN / 2 - 2} height="6" className="nipper-frame" />
          <rect x={LEFT + gate * SPAN + SPAN / 2 - 2} y="30.5" width="4" height="3" className="nipper-gate" />
          <rect x={LEFT + gate * SPAN + SPAN / 2 + 2} y="29" width={SPAN / 2 - 2} height="6" className="nipper-frame" />
        </g>
      ))}
      <g transform={`translate(${at} 0)`}>
        <g key={cut} className="nipper-tool">
          <path d="M -4 17 L -17 -6 M 4 17 L 17 -6" className="nipper-grip" />
          <path d="M -5 18 L 0 30 L 5 18 Z" className="nipper-jaw" />
          <circle cx="0" cy="17" r="3" className="nipper-jaw" />
        </g>
      </g>
    </svg>
  );
}
