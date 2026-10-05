// The load run's numbers: percentiles of the timings the bots took, and whether they meet the targets in
// docs/RELIABILITY.md (clips under 1 s and event-loop lag under 50 ms, both at the 95th percentile).

export const TARGETS = { clipP95Ms: 1000, lagP95Ms: 50 };

export function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? Number.NaN;
}

export interface LoadResult {
  lobbies: number;
  finishedGames: number;
  clipMs: number[];
  pingMs: number[];
  errors: string[];
}

export interface LoadVerdict {
  lines: string[];
  passed: boolean;
}

const ms = (value: number) => `${Math.round(value)} ms`;

// A run passes when every lobby finished its game, nothing was refused, and both p95s are under target. The
// ping's round trip on the same machine is the event loop's lag: the pong waits for the loop to come round.
export function verdictOf(result: LoadResult): LoadVerdict {
  const clipP95 = percentile(result.clipMs, 0.95);
  const lagP95 = percentile(result.pingMs, 0.95);
  const lines = [
    `${result.finishedGames} of ${result.lobbies} games finished`,
    `clips: ${result.clipMs.length}, median ${ms(percentile(result.clipMs, 0.5))}, p95 ${ms(clipP95)} (target ${ms(TARGETS.clipP95Ms)})`,
    `ping round trips: ${result.pingMs.length}, median ${ms(percentile(result.pingMs, 0.5))}, p95 ${ms(lagP95)}, max ${ms(percentile(result.pingMs, 1))} (target ${ms(TARGETS.lagP95Ms)})`,
    `errors: ${result.errors.length === 0 ? 'none' : [...new Set(result.errors)].join(', ')}`,
  ];
  const passed =
    result.finishedGames === result.lobbies &&
    result.errors.length === 0 &&
    clipP95 < TARGETS.clipP95Ms &&
    lagP95 < TARGETS.lagP95Ms;
  return { lines, passed };
}
