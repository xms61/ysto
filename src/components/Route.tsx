// The time left as a walk on the park map: a dotted route across the row to a blossom tree, the part already
// walked drawn solid, and the player's pin walking along it as the round runs down. Decoration only; the caller
// gives screen readers the seconds in words.

type Point = [number, number];

const ROUTE: Point[] = [
  [8, 20],
  [44, 9],
  [84, 21],
  [124, 10],
  [164, 21],
  [204, 11],
  [228, 18],
];

function lengthOf([ax, ay]: Point, [bx, by]: Point): number {
  return Math.hypot(bx - ax, by - ay);
}

// The route up to a share of its length, ending at the exact point reached.
function walkedTo(share: number): Point[] {
  const total = ROUTE.slice(1).reduce((sum, point, at) => sum + lengthOf(ROUTE[at]!, point), 0);
  let left = Math.min(1, Math.max(0, share)) * total;
  const walked: Point[] = [ROUTE[0]!];
  for (let at = 1; at < ROUTE.length; at++) {
    const [from, to] = [ROUTE[at - 1]!, ROUTE[at]!];
    const step = lengthOf(from, to);
    if (left <= step) {
      const t = step === 0 ? 0 : left / step;
      walked.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
      return walked;
    }
    walked.push(to);
    left -= step;
  }
  return walked;
}

const pointsOf = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

// left: the share of the round still to run, 0 to 1.
export function Route({ left }: { left: number }) {
  const walked = walkedTo(1 - left);
  const [x, y] = walked[walked.length - 1]!;
  return (
    <svg aria-hidden="true" viewBox="0 0 248 30" className="route">
      <polyline points={pointsOf(ROUTE)} className="route-ahead" />
      <polyline points={pointsOf(walked)} className="route-walked" />
      <g className="route-tree">
        <circle cx="234" cy="12" r="6" />
        <circle cx="242" cy="17" r="5" />
        <circle cx="233" cy="21" r="5" />
      </g>
      <circle cx={x} cy={y} r="5" className="route-pin" />
    </svg>
  );
}
