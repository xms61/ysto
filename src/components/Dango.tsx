// The time left as a long hanami dango skewer across the row: nine dumplings in pink, white and green, eaten one at a time from the
// tip as the round runs down, so the bare stick shows what is gone; with motion on, each pops off as it goes.
// Decoration only; the caller gives screen readers the seconds in words.

const DUMPLINGS = 9;
const COLORS = ['dango-pink', 'dango-white', 'dango-green'];
const SPACING = 22;
const RADIUS = 10;

// left: the share of the round still to run, 0 to 1. A dumpling stays until its whole share is eaten.
export function Dango({ left }: { left: number }) {
  const kept = Math.ceil(Math.min(1, Math.max(0, left)) * DUMPLINGS);
  const width = DUMPLINGS * SPACING + 24;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} 24`} className="dango">
      <line x1="2" y1="12" x2={width - 2} y2="12" className="dango-stick" />
      {Array.from({ length: DUMPLINGS }, (_, at) => (
        <circle
          key={at}
          cx={14 + at * SPACING}
          cy="12"
          r={RADIUS}
          className={COLORS[at % COLORS.length]}
          data-eaten={at >= kept || undefined}
        />
      ))}
    </svg>
  );
}
