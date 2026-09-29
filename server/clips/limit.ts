// Caps how many clip jobs run at once (YSTO_FFMPEG_CONCURRENCY); the rest wait in arrival order. A
// finished job hands its slot straight to the next one, so a new arrival can't slip in between.
export type Limit = <T>(job: () => Promise<T>) => Promise<T>;

export function concurrencyLimit(max: number): Limit {
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = (): Promise<void> => {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  return async (job) => {
    await acquire();
    try {
      return await job();
    } finally {
      release();
    }
  };
}
