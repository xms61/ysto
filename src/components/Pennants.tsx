// The time left as the referee's strip of pennants strung across the ring: ten red and white flags on a cord,
// taken down one at a time from the right as the round runs down; with motion on, each one drops as it goes.
// Decoration only; the caller gives screen readers the seconds in words.

const FLAGS = 10;
const SPACING = 22;

// left: the share of the round still to run, 0 to 1. A flag stays up until its whole share is gone.
export function Pennants({ left }: { left: number }) {
  const kept = Math.ceil(Math.min(1, Math.max(0, left)) * FLAGS);
  const width = FLAGS * SPACING + 8;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} 30`} className="pennants">
      <path d={`M2 5 Q ${width / 2} 11 ${width - 2} 5`} className="pennant-cord" />
      {Array.from({ length: FLAGS }, (_, at) => {
        const x = 6 + at * SPACING;
        const sag = 5 + 6 * (1 - ((2 * (x + 8)) / width - 1) ** 2);
        return (
          <g key={at} transform={`translate(${x} ${sag})`}>
            <polygon
              points="0,0 16,0 8,20"
              className={at % 2 === 0 ? 'pennant-red' : 'pennant-white'}
              data-gone={at >= kept || undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
