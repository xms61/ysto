// Time for the game shell: the clock and one-shot timers. Tests pass a manual scheduler and move time
// themselves.
export interface Scheduler {
  now(): number;
  // Runs `run` at `time`; the returned function cancels it.
  at(time: number, run: () => void): () => void;
}

export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  at: (time, run) => {
    const timer = setTimeout(run, Math.max(0, time - Date.now()));
    return () => clearTimeout(timer);
  },
};
