// The catalog gate: what a build must satisfy before games use it. The thresholds and their reasons are
// in docs/design-docs/catalog.md.

export const GATE = {
  minMatchedShare: 0.99,
  minPopularityShare: 0.95,
  minGenreThemes: 50,
  targetLufs: -16,
  lufsTolerance: 2,
  minLoudnessShare: 0.95,
} as const;

export interface GateInput {
  audioFiles: number;
  matchedFiles: number;
  animeInCatalog: number;
  animeWithPopularity: number;
  playableThemes: number;
  playableAnimeWithoutTitle: number;
  adultAnimeInCatalog: number;
  genreThemeCounts: Record<string, number>;
  loudnessLufs: number[];
}

export interface GateResult {
  failures: string[];
  warnings: string[];
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function loudnessFailure(loudness: number[]): string | null {
  const within = loudness.filter((lufs) => Math.abs(lufs - GATE.targetLufs) <= GATE.lufsTolerance).length;
  const shareWithin = share(within, loudness.length);
  if (shareWithin >= GATE.minLoudnessShare) return null;
  return `${percent(shareWithin)} of sampled files are within ${GATE.targetLufs} ± ${GATE.lufsTolerance} LUFS; at least ${percent(GATE.minLoudnessShare)} must be`;
}

export function evaluateGate(input: GateInput): GateResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const matched = share(input.matchedFiles, input.audioFiles);
  if (matched < GATE.minMatchedShare) {
    failures.push(`${percent(matched)} of audio files match a theme; at least ${percent(GATE.minMatchedShare)} must`);
  }
  const withPopularity = share(input.animeWithPopularity, input.animeInCatalog);
  if (withPopularity < GATE.minPopularityShare) {
    failures.push(
      `${percent(withPopularity)} of anime have a popularity; at least ${percent(GATE.minPopularityShare)} must`,
    );
  }
  if (input.playableThemes === 0) failures.push('no theme is playable');
  if (input.playableAnimeWithoutTitle > 0) {
    failures.push(`${input.playableAnimeWithoutTitle} playable anime have no title`);
  }
  if (input.adultAnimeInCatalog > 0) failures.push(`${input.adultAnimeInCatalog} adult anime are in the catalog`);
  for (const [genre, themes] of Object.entries(input.genreThemeCounts)) {
    if (themes < GATE.minGenreThemes) {
      warnings.push(
        `genre ${genre} has ${themes} playable themes, fewer than ${GATE.minGenreThemes}, so settings won't offer it`,
      );
    }
  }
  if (input.loudnessLufs.length === 0) warnings.push('loudness was not measured');
  else {
    const failure = loudnessFailure(input.loudnessLufs);
    if (failure) failures.push(failure);
  }
  return { failures, warnings };
}

// mulberry32: a small, well-mixed PRNG, so the same seed always samples the same files.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededSample<T>(items: readonly T[], count: number, seed: number): T[] {
  const shuffled = [...items];
  const random = seededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    // Both indexes are within the array: other <= index < length.
    [shuffled[index], shuffled[other]] = [shuffled[other] as T, shuffled[index] as T];
  }
  return shuffled.slice(0, Math.max(0, count));
}
