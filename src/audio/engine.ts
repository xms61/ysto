// Plays each round's clip through Web Audio: fetch, decode, then a gain node for the volume, which works on
// iPhones too, where media elements ignore their volume (docs/design-docs/audio-clips.md). A clip starts at
// the round's start time, or partway in when it's ready late, so every player hears the same moment. The game's
// sound effects (sounds.ts) go through the same volume.
import type { Tone } from './sounds.ts';

// 'locked' until a tap lets audio start, and again after the system suspends it (an iPhone's lock screen).
export type AudioState = 'locked' | 'running' | 'unavailable';

// The parts of Web Audio the engine uses, so tests can stand in for them.
export interface AudioParamLike {
  value: number;
  cancelScheduledValues(startTime: number): unknown;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface AudioBufferLike {
  readonly duration: number;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  onended: ((event: Event) => void) | null;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export interface OscillatorLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  onended: ((event: Event) => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string; // Safari adds 'interrupted' to the standard states
  readonly destination: AudioNodeLike;
  onstatechange: ((event: Event) => void) | null;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): BufferSourceLike;
  createOscillator(): OscillatorLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
}

export interface AudioDeps {
  createContext: () => AudioContextLike;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number; // this browser's clock, the one start times are given in
}

// The engine as the game drives it.
export interface ClipPlayer {
  load(clipToken: string, sessionToken: string): Promise<boolean>;
  play(startsAt: number): void;
  stop(): void;
}

const FADE_OUT_S = 0.4;
// The sound effects play at this share of the game's volume, so they sit under the clip.
const SOUND_SHARE = 0.35;
const ATTACK_S = 0.005;
const SILENCE = 0.0001; // an exponential ramp can't reach 0
const VOLUME_SMOOTHING_S = 0.02;

interface Clip {
  token: string;
  buffer: AudioBufferLike | null; // null while loading
  startsAt: number | null; // local time, once the round has a start
  playing: { source: BufferSourceLike; fade: GainNodeLike } | null;
}

export class AudioEngine implements ClipPlayer {
  readonly #deps: AudioDeps;
  readonly #listeners = new Set<() => void>();
  #context: AudioContextLike | null = null;
  #master: GainNodeLike | null = null;
  #unavailable = false;
  #volume = 0;
  #clip: Clip | null = null;

  constructor(deps: AudioDeps) {
    this.#deps = deps;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = (): AudioState => {
    if (this.#unavailable) return 'unavailable';
    return this.#context?.state === 'running' ? 'running' : 'locked';
  };

  // Browsers let audio start only from a tap, a click or a key, so call this from their handlers: the Create
  // and Join buttons, and the sound button after a reload.
  unlock(): void {
    const context = this.#ensureContext();
    if (!context || context.state === 'running') return;
    context.resume().catch(() => this.#notify());
  }

  // A fraction from 0 to 1 of the clip's own level.
  setVolume(volume: number): void {
    this.#volume = volume;
    const context = this.#context;
    if (context && this.#master) this.#master.gain.setTargetAtTime(volume, context.currentTime, VOLUME_SMOOTHING_S);
  }

  // Fetches and decodes a round's clip in place of the one before. False when it can't be played.
  async load(clipToken: string, sessionToken: string): Promise<boolean> {
    this.stop();
    const clip: Clip = { token: clipToken, buffer: null, startsAt: null, playing: null };
    this.#clip = clip;
    const context = this.#ensureContext();
    if (!context) return false;
    try {
      const response = await this.#deps.fetch(`/api/clips/${encodeURIComponent(clipToken)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        cache: 'no-store',
      });
      if (!response.ok) return false;
      clip.buffer = await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return false;
    }
    this.#startIfDue(clip);
    return true;
  }

  // Starts the loaded clip at a local time: later if that's in the future, at once and partway in if it's past.
  play(startsAt: number): void {
    const clip = this.#clip;
    if (!clip) return;
    clip.startsAt = startsAt;
    this.#startIfDue(clip);
  }

  // Plays a sound effect's tones, starting `delayS` from now. Nothing plays while audio is locked or muted.
  playTones(tones: readonly Tone[], delayS = 0): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || context.state !== 'running' || this.#volume === 0) return;
    const start = context.currentTime + delayS;
    for (const tone of tones) this.#playTone(context, master, tone, start + tone.at);
  }

  #playTone(context: AudioContextLike, master: GainNodeLike, tone: Tone, at: number): void {
    const end = at + tone.length;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(tone.level * SOUND_SHARE, at + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
    envelope.connect(master);
    const oscillator = context.createOscillator();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.from, at);
    if (tone.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    oscillator.connect(envelope);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(end);
  }

  // Fades the clip out, so a skipped round or the next one never cuts it off with a click.
  stop(): void {
    const clip = this.#clip;
    this.#clip = null;
    const context = this.#context;
    if (!clip?.playing || !context) return;
    const { source, fade } = clip.playing;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
    };
    source.stop(now + FADE_OUT_S);
  }

  #ensureContext(): AudioContextLike | null {
    if (this.#context || this.#unavailable) return this.#context;
    try {
      const context = this.#deps.createContext();
      const master = context.createGain();
      master.gain.value = this.#volume;
      master.connect(context.destination);
      context.onstatechange = () => this.#stateChanged();
      this.#context = context;
      this.#master = master;
    } catch {
      this.#unavailable = true;
    }
    this.#notify();
    return this.#context;
  }

  // A context that starts running again (after the first tap, or when an iPhone unlocks) plays the clip
  // from where the round is now, not from where it stopped.
  #stateChanged(): void {
    const clip = this.#clip;
    if (clip && this.#context?.state === 'running') {
      if (clip.playing) {
        clip.playing.source.stop();
        clip.playing.fade.disconnect();
        clip.playing = null;
      }
      this.#startIfDue(clip);
    }
    this.#notify();
  }

  #startIfDue(clip: Clip): void {
    const context = this.#context;
    const master = this.#master;
    if (this.#clip !== clip || !context || !master || context.state !== 'running') return;
    if (!clip.buffer || clip.startsAt === null || clip.playing) return;
    const delayS = (clip.startsAt - this.#deps.now()) / 1000;
    const offsetS = Math.max(0, -delayS);
    if (offsetS >= clip.buffer.duration) return;
    const fade = context.createGain();
    fade.connect(master);
    const source = context.createBufferSource();
    source.buffer = clip.buffer;
    source.connect(fade);
    source.start(context.currentTime + Math.max(0, delayS), offsetS);
    clip.playing = { source, fade };
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

// iPhones play Web Audio as ambient sound, which the silent switch mutes. A music quiz is media playback, so
// the engine asks for that where Safari offers the Audio Session API.
function preferPlaybackSession(): void {
  // TypeScript's DOM types don't include the Audio Session API yet; it's optional here, as in most browsers.
  const { audioSession } = navigator as Navigator & { audioSession?: { type: string } };
  if (audioSession) audioSession.type = 'playback';
}

export function browserAudio(): AudioEngine {
  return new AudioEngine({
    createContext: () => {
      preferPlaybackSession();
      return new AudioContext();
    },
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
  });
}
