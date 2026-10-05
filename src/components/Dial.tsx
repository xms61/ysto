// The time left as a gachapon's coin dial: a chrome knob with a grip bar, ringed by twelve ticks. The knob turns
// once round over the round, and each tick goes grey as its share is spent; with motion on, the knob turns
// smoothly between seconds. Decoration only; the caller gives screen readers the seconds in words.

const TICKS = 12;

// left: the share of the round still to run, 0 to 1. A tick stays lit until its whole share is spent.
export function Dial({ left }: { left: number }) {
  const share = Math.min(1, Math.max(0, left));
  const lit = Math.ceil(share * TICKS);
  return (
    <svg aria-hidden="true" viewBox="0 0 52 52" className="dial">
      {Array.from({ length: TICKS }, (_, at) => (
        <line
          key={at}
          x1="26"
          y1="3"
          x2="26"
          y2="7"
          transform={`rotate(${(at * 360) / TICKS} 26 26)`}
          className="dial-tick"
          data-turned={at < TICKS - lit || undefined}
        />
      ))}
      <circle cx="26" cy="26" r="16" className="dial-body" />
      <g className="dial-knob" style={{ transform: `rotate(${(1 - share) * 360}deg)` }}>
        <rect x="23" y="12" width="6" height="28" rx="3" className="dial-grip" />
      </g>
    </svg>
  );
}
