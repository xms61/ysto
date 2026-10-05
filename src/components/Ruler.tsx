// The time left as a printer's steel ruler across the row: ticked in millimetres with a longer mark every
// centimetre, and a process-cyan bar along its top edge that shortens from the right as the round runs.
// Decoration only; the caller gives screen readers the seconds in words.

const LENGTH = 240;
const STEP = 4;

// left: the share of the round still to run, 0 to 1.
export function Ruler({ left }: { left: number }) {
  const share = Math.min(1, Math.max(0, left));
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${LENGTH + 4} 22`} preserveAspectRatio="none" className="ruler">
      <rect x="2" y="6" width={LENGTH} height="14" className="ruler-body" />
      {Array.from({ length: LENGTH / STEP + 1 }, (_, at) => (
        <line
          key={at}
          x1={2 + at * STEP}
          y1="20"
          x2={2 + at * STEP}
          y2={at % 10 === 0 ? 11 : at % 5 === 0 ? 14 : 16}
          className="ruler-tick"
        />
      ))}
      <rect x="2" y="1" width={LENGTH} height="4" className="ruler-left" style={{ transform: `scaleX(${share})` }} />
    </svg>
  );
}
