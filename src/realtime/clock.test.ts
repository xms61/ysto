import { expect, test } from 'vitest';
import { ServerClock } from './clock.ts';

function clockAt(): { clock: ServerClock; setNow: (time: number) => void } {
  let now = 0;
  return { clock: new ServerClock(() => now), setNow: (time) => (now = time) };
}

test('estimates the offset from a pong, halfway through its round trip', () => {
  const { clock, setNow } = clockAt();
  setNow(1100);
  clock.record(1000, 5050);
  expect(clock.offsetMs).toBe(4000);
  setNow(2000);
  expect(clock.serverNow()).toBe(6000);
  expect(clock.toLocal(6000)).toBe(2000);
});

test('trusts the sample with the shortest round trip', () => {
  const { clock, setNow } = clockAt();
  setNow(1100);
  clock.record(1000, 5050);
  setNow(1500);
  clock.record(1100, 5900);
  expect(clock.offsetMs).toBe(4000);
});

test('ignores a pong for a ping this clock never sent', () => {
  const { clock, setNow } = clockAt();
  setNow(1000);
  clock.record(2000, 9000);
  expect(clock.offsetMs).toBe(0);
});

test('forgets samples older than the last eight', () => {
  const { clock, setNow } = clockAt();
  setNow(1010);
  clock.record(1000, 1005);
  for (let sample = 1; sample <= 8; sample++) {
    setNow(2000 * sample + 100);
    clock.record(2000 * sample, 2000 * sample + 50 + 300);
  }
  expect(clock.offsetMs).toBe(300);
});
