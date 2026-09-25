// Randomness for the game. Live games use the operating system's secure generator, so nobody can predict
// songs, sample offsets or option order; tests and sampled checks use a seeded one, so runs repeat.
import { randomInt } from 'node:crypto';

export interface Random {
  // A whole number from 0 up to, but not including, maxExclusive.
  int(maxExclusive: number): number;
}

export const secureRandom: Random = {
  int: (maxExclusive) => randomInt(maxExclusive),
};

// mulberry32: small and well mixed. For tests and seeded samples, never for live games.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (maxExclusive) => Math.floor(next() * maxExclusive) };
}

export function pick<T>(items: readonly T[], random: Random): T {
  if (items.length === 0) throw new Error('Cannot pick from an empty list');
  // The index is below the length of a list that isn't empty.
  return items[random.int(items.length)] as T;
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = random.int(index + 1);
    // Both indexes are within the array: other <= index < length.
    [shuffled[index], shuffled[other]] = [shuffled[other] as T, shuffled[index] as T];
  }
  return shuffled;
}
