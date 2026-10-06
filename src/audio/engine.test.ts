import { expect, test, vi } from 'vitest';
import { FakeAudioContext } from '../testing/fakes.ts';
import { AudioEngine } from './engine.ts';

function engineWith({ status = 200, createFails = false } = {}) {
  const context = new FakeAudioContext();
  let now = 50_000;
  const fetch = vi.fn(async () => new Response(new ArrayBuffer(16), { status }));
  const engine = new AudioEngine({
    createContext: () => {
      if (createFails) throw new Error('no Web Audio');
      return context;
    },
    fetch,
    now: () => now,
  });
  return { engine, context, fetch, setNow: (time: number) => (now = time) };
}

function master(context: FakeAudioContext) {
  const gain = context.gains[0];
  if (!gain) throw new Error('the engine made no master gain');
  return gain;
}

test('stays locked until a tap unlocks it', () => {
  const { engine, context } = engineWith();
  expect(engine.getState()).toBe('locked');
  engine.unlock();
  expect(context.state).toBe('running');
  expect(engine.getState()).toBe('running');
});

test('reports audio as unavailable when the browser has no Web Audio', async () => {
  const { engine } = engineWith({ createFails: true });
  engine.unlock();
  expect(engine.getState()).toBe('unavailable');
  expect(await engine.load('clip', 'session')).toBe(false);
});

test('fetches the clip with the session token, and decodes it', async () => {
  const { engine, fetch } = engineWith();
  expect(await engine.load('clip-1', 'session-1')).toBe(true);
  expect(fetch).toHaveBeenCalledWith('/api/clips/clip-1', {
    headers: { Authorization: 'Bearer session-1' },
    cache: 'no-store',
  });
});

test("reports a clip it couldn't fetch or decode", async () => {
  expect(await engineWith({ status: 404 }).engine.load('clip', 'session')).toBe(false);
  const { engine, context } = engineWith();
  context.failDecode = true;
  expect(await engine.load('clip', 'session')).toBe(false);
});

test('starts the clip at the round start, or partway in when the start has passed', async () => {
  const { engine, context, setNow } = engineWith();
  engine.unlock();
  await engine.load('clip-1', 'session');
  engine.play(51_500);
  expect(context.sources[0]?.started).toEqual({ when: 101.5, offset: 0 });
  await engine.load('clip-2', 'session');
  setNow(54_000);
  engine.play(50_000);
  expect(context.sources[1]?.started).toEqual({ when: 100, offset: 4 });
  await engine.load('clip-3', 'session');
  engine.play(20_000);
  expect(context.sources).toHaveLength(2);
});

test('plays a clip that loads after the round started, from where the round is', async () => {
  const { engine, context, setNow } = engineWith();
  engine.unlock();
  const loading = engine.load('clip', 'session');
  engine.play(50_000);
  setNow(52_500);
  await loading;
  expect(context.sources[0]?.started).toEqual({ when: 100, offset: 2.5 });
});

test('holds the clip until the tap, then starts it where the round is', async () => {
  const { engine, context, setNow } = engineWith();
  await engine.load('clip', 'session');
  engine.play(50_000);
  expect(context.sources).toHaveLength(0);
  setNow(53_000);
  engine.unlock();
  expect(context.sources[0]?.started).toEqual({ when: 100, offset: 3 });
});

test('resyncs a clip the system suspended', async () => {
  const { engine, context, setNow } = engineWith();
  engine.unlock();
  await engine.load('clip', 'session');
  engine.play(50_000);
  context.setState('interrupted');
  expect(engine.getState()).toBe('locked');
  setNow(56_000);
  context.setState('running');
  expect(context.sources[0]?.stoppedAt).toBe(0);
  expect(context.sources[1]?.started).toEqual({ when: 100, offset: 6 });
});

test('fades the clip out when it stops', async () => {
  const { engine, context } = engineWith();
  engine.unlock();
  await engine.load('clip', 'session');
  engine.play(50_000);
  engine.stop();
  const fade = context.gains[1];
  expect(fade?.gain.calls).toEqual(['cancel@100', 'set 1@100', 'ramp 0@100.4']);
  expect(context.sources[0]?.stoppedAt).toBe(100.4);
});

test('sets the volume on the master gain, before and after the tap', () => {
  const { engine, context } = engineWith();
  engine.setVolume(0.15);
  engine.unlock();
  expect(master(context).gain.value).toBe(0.15);
  engine.setVolume(0.5);
  expect(master(context).gain.calls).toEqual(['target 0.5@100']);
});

const BEEP = [{ wave: 'square', from: 880, to: 440, at: 0.1, length: 0.2, level: 0.5 }] as const;

test('plays a sound effect as oscillators under the master volume, after its delay', () => {
  const { engine, context } = engineWith();
  engine.setVolume(0.5);
  engine.unlock();
  engine.playTones(BEEP, 0.82);
  const [oscillator] = context.oscillators;
  expect(oscillator?.type).toBe('square');
  expect(oscillator?.started).toBeCloseTo(100.92);
  expect(oscillator?.stoppedAt).toBeCloseTo(101.12);
  expect(oscillator?.frequency.calls).toEqual([
    expect.stringMatching(/^set 880@100\.9[12]/),
    expect.stringMatching(/^exp 440@101\.1[12]/),
  ]);
  const envelope = context.gains[1];
  expect(oscillator?.outputs).toEqual([envelope]);
  expect(envelope?.outputs).toEqual([master(context)]);
});

test('plays no sound effect while audio is locked or the volume is 0', () => {
  const { engine, context } = engineWith();
  engine.setVolume(0.5);
  engine.playTones(BEEP);
  expect(context.oscillators).toHaveLength(0);
  engine.unlock();
  engine.setVolume(0);
  engine.playTones(BEEP);
  expect(context.oscillators).toHaveLength(0);
});
