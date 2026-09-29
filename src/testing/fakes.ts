// Stand-ins for the browser's socket and Web Audio, and builders for server messages, for the client tests.
// Nothing here ships: only tests import it.
import type { LobbyState, OptionTitles, RoundReveal } from '../../shared/protocol.ts';
import { defaultSettings } from '../../shared/settings.ts';
import type { SettingsBounds } from '../../shared/settings.ts';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BufferSourceLike,
  ClipPlayer,
  GainNodeLike,
} from '../audio/engine.ts';
import type { SocketLike } from '../realtime/connection.ts';
import type { Session } from '../realtime/session.ts';

export class FakeSocket implements SocketLike {
  readonly url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: Record<string, unknown>[] = [];
  closedByClient = false;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closedByClient = true;
    this.readyState = 3;
  }

  // What the server does:
  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  closeFromServer(code: number): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { code }));
  }

  sentOfType(type: string): Record<string, unknown>[] {
    return this.sent.filter((message) => message.type === type);
  }
}

// Records every socket it makes; the latest one is the live connection.
export function socketFactory(): {
  create: (url: string) => FakeSocket;
  sockets: FakeSocket[];
  latest: () => FakeSocket;
} {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    create: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    latest: () => {
      const socket = sockets.at(-1);
      if (!socket) throw new Error('no socket was opened');
      return socket;
    },
  };
}

export class FakeParam implements AudioParamLike {
  value: number;
  readonly calls: string[] = [];

  constructor(value: number) {
    this.value = value;
  }

  cancelScheduledValues(startTime: number): void {
    this.calls.push(`cancel@${startTime}`);
  }

  setValueAtTime(value: number, startTime: number): void {
    this.calls.push(`set ${value}@${startTime}`);
  }

  linearRampToValueAtTime(value: number, endTime: number): void {
    this.calls.push(`ramp ${value}@${endTime}`);
  }

  setTargetAtTime(target: number, startTime: number): void {
    this.calls.push(`target ${target}@${startTime}`);
    this.value = target;
  }
}

class FakeNode implements AudioNodeLike {
  readonly outputs: AudioNodeLike[] = [];

  connect(destination: AudioNodeLike): void {
    this.outputs.push(destination);
  }

  disconnect(): void {
    this.outputs.length = 0;
  }
}

export class FakeGain extends FakeNode implements GainNodeLike {
  readonly gain = new FakeParam(1);
}

export class FakeSource extends FakeNode implements BufferSourceLike {
  buffer: AudioBufferLike | null = null;
  onended: ((event: Event) => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stoppedAt: number | null = null;

  start(when = 0, offset = 0): void {
    this.started = { when, offset };
  }

  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

export class FakeAudioContext implements AudioContextLike {
  currentTime = 100;
  state = 'suspended';
  readonly destination = new FakeNode();
  onstatechange: ((event: Event) => void) | null = null;
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  clipSeconds = 20;
  failDecode = false;

  resume(): Promise<void> {
    this.setState('running');
    return Promise.resolve();
  }

  setState(state: string): void {
    this.state = state;
    this.onstatechange?.(new Event('statechange'));
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  decodeAudioData(): Promise<AudioBufferLike> {
    return this.failDecode ? Promise.reject(new Error('not audio')) : Promise.resolve({ duration: this.clipSeconds });
  }
}

// Records what the game asks of the clip player. Loads finish at once, unless held for a test to release.
export class FakeClipPlayer implements ClipPlayer {
  readonly calls: string[] = [];
  loaded = true;
  hold = false;
  #release: (() => void) | null = null;

  load(clipToken: string): Promise<boolean> {
    this.calls.push(`load ${clipToken}`);
    if (!this.hold) return Promise.resolve(this.loaded);
    return new Promise((resolve) => {
      this.#release = () => resolve(this.loaded);
    });
  }

  release(): void {
    this.#release?.();
  }

  play(startsAt: number): void {
    this.calls.push(`play ${startsAt}`);
  }

  stop(): void {
    this.calls.push('stop');
  }
}

export const BOUNDS: SettingsBounds = { years: { from: 2000, to: 2024 }, genres: ['Action', 'Drama'], maxRank: 500 };

export const SESSION: Session = { code: 'ABC234', playerId: 'p1', sessionToken: 'a'.repeat(43) };

export function lobbyState(overrides: Partial<LobbyState> = {}): LobbyState {
  return {
    type: 'lobby:state',
    code: 'ABC234',
    you: 'p1',
    hostId: 'p1',
    locked: false,
    players: [
      { id: 'p1', name: 'Ann', connected: true, spectating: false, score: 0 },
      { id: 'p2', name: 'Ben', connected: true, spectating: false, score: 0 },
    ],
    settings: defaultSettings(BOUNDS),
    pool: { themes: 300, anime: 120 },
    bounds: BOUNDS,
    game: null,
    ...overrides,
  };
}

export const OPTIONS: OptionTitles = {
  english: ['Rain Song', 'Petal Story', 'Speed Line', 'Neon Night'],
  romaji: ['Ame no Uta', 'Hanabira Monogatari', 'Supiido Rain', 'Neon Naito'],
  japanese: ['雨の歌', '花びら物語', 'スピードライン', 'ネオンナイト'],
};

export function revealOf(roundId: string, overrides: Partial<RoundReveal> = {}): RoundReveal {
  return {
    type: 'round:reveal',
    roundId,
    skipped: false,
    correct: 2,
    picks: [
      { playerId: 'p1', option: 2, points: 850, noAudio: false },
      { playerId: 'p2', option: 0, points: 0, noAudio: true },
    ],
    standings: [
      { playerId: 'p1', score: 850, streak: 1 },
      { playerId: 'p2', score: 0, streak: 0 },
    ],
    anime: { english: 'Speed Line', romaji: 'Supiido Rain', japanese: 'スピードライン' },
    theme: { kind: 'OP', sequence: 2 },
    song: { title: 'Full Throttle', artists: [{ name: 'Singer', as: 'Heroine' }] },
    year: 2019,
    season: 'Spring',
    cover: null,
    ...overrides,
  };
}
