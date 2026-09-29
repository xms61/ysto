// Counts events per key over a sliding window (docs/SECURITY.md#input), such as lobby creations per IP.
// Keys live in memory only. Once per window, recording an event drops the keys with no recent events, so
// memory holds only the keys active lately.
export class RateLimit {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #hits = new Map<string, number[]>();
  #sweptAt: number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
    this.#sweptAt = now();
  }

  // Records an event for the key; false when the key had already used up its window.
  take(key: string): boolean {
    this.#sweepOncePerWindow();
    if (this.exhausted(key)) return false;
    this.#hits.set(key, [...this.#recent(key), this.#now()]);
    return true;
  }

  exhausted(key: string): boolean {
    return this.#recent(key).length >= this.#limit;
  }

  // Whole seconds until the key may act again, for a Retry-After header.
  retryAfterSec(key: string): number {
    const oldest = this.#recent(key)[0];
    return oldest === undefined ? 0 : Math.max(1, Math.ceil((oldest + this.#windowMs - this.#now()) / 1000));
  }

  #sweepOncePerWindow(): void {
    if (this.#now() - this.#sweptAt < this.#windowMs) return;
    this.#sweptAt = this.#now();
    for (const key of [...this.#hits.keys()]) {
      if (this.#recent(key).length === 0) this.#hits.delete(key);
    }
  }

  #recent(key: string): number[] {
    const since = this.#now() - this.#windowMs;
    return (this.#hits.get(key) ?? []).filter((time) => time > since);
  }
}
