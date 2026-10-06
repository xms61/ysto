// A QR code of the join link, drawn as one SVG path. It stays dark on white in every theme, with the
// four-module quiet zone scanners expect.
import { useMemo } from 'react';
import { encode } from 'uqr';

const QUIET_ZONE = 4;

function modulePath(modules: boolean[][]): string {
  return modules.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('');
}

export function QrCode({ text, label, className = 'size-40' }: { text: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const { data } = encode(text, { ecc: 'M', border: 0 });
    return { size: data.length, path: modulePath(data) };
  }, [text]);
  const extent = size + 2 * QUIET_ZONE;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className={`${className} rounded-lg`}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
