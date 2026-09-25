// Runs async tasks with a fixed number in flight, for the ffprobe, ffmpeg and download steps.
import { availableParallelism } from 'node:os';

export function defaultConcurrency(): number {
  return Math.max(1, availableParallelism() - 1);
}

export async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      // The index is in range: the loop condition checked it, and no other worker ran in between.
      const item = items[next++] as T;
      await task(item);
    }
  };
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
}
