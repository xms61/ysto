// Hooks that read time for the round screens, and that tell the page which part of the game it shows.
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

// Where the game stands, for the backdrop's weather: calm in the lobby, building through the countdown,
// surging while the clip plays, bursting at the reveal and the results. It follows the game's phase only,
// never the audio, so the weather can't give a song away.
export type PagePhase = 'lobby' | 'countdown' | 'playing' | 'reveal' | 'results';

export function usePagePhase(phase: PagePhase): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.phase = phase;
    return () => {
      if (root.dataset.phase === phase) delete root.dataset.phase;
    };
  }, [phase]);
}

// Motion that script drives (a count, a flap, a buzz) asks the page, which follows the player's setting.
export function motionAllowed(): boolean {
  return document.documentElement.dataset.motion === 'full';
}

// A number that counts up to `target` after `delayMs`, or shows it at once without motion.
export function useCountUp(target: number, delayMs: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (motionAllowed() ? 0 : target));
  useEffect(() => {
    if (!motionAllowed()) return;
    let frame = 0;
    const startAt = performance.now() + delayMs;
    const step = (time: number) => {
      const progress = Math.min(1, Math.max(0, (time - startAt) / durationMs));
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs, durationMs]);
  return value;
}
