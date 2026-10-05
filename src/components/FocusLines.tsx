// The time left as a manga panel's focus lines: ink wedges drawn in from the frame toward its center, reaching
// further in as the round runs down, so the clear space in the middle tightens to a point. Decoration only; the
// caller gives screen readers the seconds in words.

const WIDTH = 240;
const HEIGHT = 44;
const LINES = 44;
const [CX, CY] = [WIDTH / 2, HEIGHT / 2];

// Where each line starts: evenly spread round the center, on the panel's frame.
const STARTS = Array.from({ length: LINES }, (_, at) => {
  const angle = (at / LINES) * Math.PI * 2 + 0.05;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  const reach = Math.min(Math.abs(CX / dx), Math.abs(CY / dy));
  return { x: CX + dx * reach, y: CY + dy * reach, dx, dy };
});

// left: the share of the round still to run, 0 to 1. Each wedge ends this share of the way out from the center.
export function FocusLines({ left }: { left: number }) {
  const clear = 0.12 + 0.8 * Math.min(1, Math.max(0, left));
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="focus-lines">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} className="focus-frame" />
      {STARTS.map(({ x, y, dx, dy }, at) => {
        const [tipX, tipY] = [CX + (x - CX) * clear, CY + (y - CY) * clear];
        const [nx, ny] = [-dy * 1.6, dx * 1.6];
        return (
          <polygon key={at} points={`${x + nx},${y + ny} ${x - nx},${y - ny} ${tipX},${tipY}`} className="focus-line" />
        );
      })}
    </svg>
  );
}
