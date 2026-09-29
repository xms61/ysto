import { beforeEach, expect, test } from 'vitest';
import { readSession, writeSession } from './session.ts';

const SEAT = { code: 'ABC234', playerId: 'p1', sessionToken: 'a'.repeat(43) };

beforeEach(() => sessionStorage.clear());

test('keeps the seat for this tab, and forgets it', () => {
  expect(readSession(sessionStorage)).toBeNull();
  writeSession(sessionStorage, SEAT);
  expect(readSession(sessionStorage)).toEqual(SEAT);
  writeSession(sessionStorage, null);
  expect(readSession(sessionStorage)).toBeNull();
});

test('ignores a stored seat that is damaged or has no valid code', () => {
  const CASES: string[] = [
    '{broken',
    JSON.stringify({ ...SEAT, sessionToken: 7 }),
    JSON.stringify({ ...SEAT, code: 'O0O0O0' }),
    JSON.stringify([SEAT]),
  ];
  for (const stored of CASES) {
    sessionStorage.setItem('ysto_session', stored);
    expect(readSession(sessionStorage), stored).toBeNull();
  }
});

test('reads a stored code in its normal form', () => {
  sessionStorage.setItem('ysto_session', JSON.stringify({ ...SEAT, code: 'abc234' }));
  expect(readSession(sessionStorage)?.code).toBe('ABC234');
});
