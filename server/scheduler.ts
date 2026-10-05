// Time for the game shell: the clock and one-shot timers. Tests pass a manual scheduler and move time
// themselves.
export interface Scheduler {
  now(): number;
  // Runs `run` at `time`, never before now() has reached it; the returned function cancels it.
  at(time: number, run: () => void): () => void;
}

export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  at: (time, run) => {
    // A timer can fire a millisecond before Date.now() reaches its time. The game checks the clock when its
    // timers run, so an early run would be ignored and never repeated, leaving a round open for good: wait
    // out the rest instead.
    const fire = () => {
      const left = time - Date.now();
      if (left > 0) timer = setTimeout(fire, left);
      else run();
    };
    let timer = setTimeout(fire, Math.max(0, time - Date.now()));
    return () => clearTimeout(timer);
  },
};
