// Clip tokens (docs/design-docs/audio-clips.md): an opaque random token per round's clip, valid for one
// lobby until it expires. The clip stays in memory until then; expired entries go when the next is issued.
import { newToken } from '../tokens.ts';

interface Entry {
  lobbyId: string;
  audio: Buffer;
  expiresAt: number;
}

export class ClipTokens {
  readonly #entries = new Map<string, Entry>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  // Called with the prepare message; the round moves the expiry to 10 s after its reveal with expireAt.
  issue(lobbyId: string, audio: Buffer, expiresAt: number): string {
    this.#dropExpired();
    const token = newToken();
    this.#entries.set(token, { lobbyId, audio, expiresAt });
    return token;
  }

  expireAt(token: string, expiresAt: number): void {
    const entry = this.#entries.get(token);
    if (entry) entry.expiresAt = expiresAt;
  }

  // Unknown, expired and other-lobby tokens all find nothing, so the route can't tell them apart either.
  find(token: string, lobbyId: string): Buffer | undefined {
    const entry = this.#entries.get(token);
    if (!entry || entry.lobbyId !== lobbyId || entry.expiresAt <= this.#now()) return undefined;
    return entry.audio;
  }

  #dropExpired(): void {
    const now = this.#now();
    for (const [token, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(token);
    }
  }
}
