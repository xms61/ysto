// The time left as a candle on the guild's counter: the wax burns down in its brass dish as the round runs,
// past the hour marks pressed into it, and the flame goes out at the end; with motion on, the flame flickers.
// Decoration only; the caller gives screen readers the seconds in words.

const BASE = 64;
const TALL = 50;
const MARKS = [10, 20, 30, 40];

// left: the share of the round still to run, 0 to 1.
export function Candle({ left }: { left: number }) {
  const wax = Math.min(1, Math.max(0, left)) * TALL;
  const top = BASE - wax;
  return (
    <svg aria-hidden="true" viewBox="0 0 28 72" className="candle">
      <rect x="8" y={top} width="12" height={wax} rx="1.5" className="candle-wax" />
      {MARKS.filter((mark) => mark < wax).map((mark) => (
        <line key={mark} x1="8" y1={BASE - mark} x2="12" y2={BASE - mark} className="candle-mark" />
      ))}
      {wax > 0 && (
        <>
          <line x1="14" y1={top} x2="14" y2={top - 3} className="candle-wick" />
          <path
            d={`M 14 ${top - 14} C 18 ${top - 8} 18 ${top - 3} 14 ${top - 2} C 10 ${top - 3} 10 ${top - 8} 14 ${top - 14} Z`}
            className="candle-flame"
          />
        </>
      )}
      <rect x="2" y={BASE} width="24" height="5" rx="2.5" className="candle-holder" />
    </svg>
  );
}
