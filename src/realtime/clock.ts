// The server's clock as this browser sees it, since round starts and deadlines arrive in server time. Each
// time:pong gives an estimate of the offset, and the one with the shortest round trip is the most accurate.
const SAMPLES_KEPT = 8;

interface Sample {
  roundTripMs: number;
  offsetMs: number;
}

export class ServerClock {
  readonly #now: () => number;
  #samples: Sample[] = [];

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  // A pong for the ping sent at clientTime, answered by the server at serverTime.
  record(clientTime: number, serverTime: number): void {
    const receivedAt = this.#now();
    const roundTripMs = receivedAt - clientTime;
    if (roundTripMs < 0) return;
    const offsetMs = serverTime + roundTripMs / 2 - receivedAt;
    this.#samples = [...this.#samples, { roundTripMs, offsetMs }].slice(-SAMPLES_KEPT);
  }

  get offsetMs(): number {
    const best = this.#samples.reduce<Sample | null>(
      (fastest, sample) => (fastest === null || sample.roundTripMs < fastest.roundTripMs ? sample : fastest),
      null,
    );
    return best?.offsetMs ?? 0;
  }

  serverNow(): number {
    return this.#now() + this.offsetMs;
  }

  // A server time on this browser's clock.
  toLocal(serverTime: number): number {
    return serverTime - this.offsetMs;
  }
}
