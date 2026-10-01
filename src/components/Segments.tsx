// A number on a seven-segment display, like the LED on a ticket machine: lit segments in the current color,
// the unlit ones faintly behind them. Decoration only; the caller gives screen readers the number in words.

type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

// Each digit is 12 by 20 units: three bars across (a at the top, g in the middle, d at the foot) and four
// down (f and b above the middle, e and c below), each a long hexagon.
function across(y: number): string {
  return `2,${y} 3,${y - 1} 9,${y - 1} 10,${y} 9,${y + 1} 3,${y + 1}`;
}

function down(x: number, top: number, bottom: number): string {
  return `${x},${top} ${x + 1},${top + 1} ${x + 1},${bottom - 1} ${x},${bottom} ${x - 1},${bottom - 1} ${x - 1},${top + 1}`;
}

const SHAPES: Record<Segment, string> = {
  a: across(1.5),
  b: down(10.5, 2, 9.5),
  c: down(10.5, 10.5, 18),
  d: across(18.5),
  e: down(1.5, 10.5, 18),
  f: down(1.5, 2, 9.5),
  g: across(10),
};

const LIT: Record<string, Segment[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

const ALL: Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

function Digit({ glyph }: { glyph: string }) {
  const lit = LIT[glyph] ?? [];
  return (
    <svg viewBox="0 0 12 20" className="segment-digit">
      {ALL.map((segment) => (
        <polygon
          key={segment}
          points={SHAPES[segment]}
          className={lit.includes(segment) ? 'segment-on' : 'segment-off'}
        />
      ))}
    </svg>
  );
}

export function Segments({ value, digits }: { value: number; digits: number }) {
  const text = String(Math.max(0, Math.floor(value))).padStart(digits, '0');
  return (
    <span aria-hidden="true" className="segments">
      {[...text].map((glyph, at) => (
        <Digit key={at} glyph={glyph} />
      ))}
    </span>
  );
}
