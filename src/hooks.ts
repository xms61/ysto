// Hooks that read time for the round screens.
import { useEffect, useState } from 'react';

// The time from `now`, read when the component mounts and again every `intervalMs`, for countdowns and
// progress bars.
export function useTicker(now: () => number, intervalMs: number): number {
  const [time, setTime] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => setTime(now()), intervalMs);
    return () => clearInterval(timer);
  }, [now, intervalMs]);
  return time;
}

// Whether `at` has come, flipping at that moment rather than on the next tick: the options appear exactly
// when the clip starts.
export function useReached(now: () => number, at: number | null): boolean {
  const [reachedAt, setReachedAt] = useState<number | null>(null);
  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(() => setReachedAt(at), Math.max(0, at - now()));
    return () => clearTimeout(timer);
  }, [now, at]);
  return at !== null && reachedAt === at;
}
