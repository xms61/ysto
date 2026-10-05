import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCode, parseClientMessage, parseNameBody } from '../../shared/protocol.ts';
import { defaultSettings } from '../../shared/settings.ts';
import type { SettingsBounds } from '../../shared/settings.ts';

const bounds: SettingsBounds = { years: { from: 1963, to: 2026 }, genres: ['Action'], maxRank: 4000 };
const settings = defaultSettings(bounds);

test('reads a name body with nothing else in it', () => {
  assert.deepEqual(parseNameBody({ name: 'Mikasa' }), { name: 'Mikasa' });
  for (const body of [null, 'Mikasa', { name: 5 }, { name: 'Mikasa', host: true }, { name: 'x'.repeat(201) }]) {
    assert.equal(parseNameBody(body), null, JSON.stringify(body));
  }
});

test('accepts lobby codes in any case, and nothing else', () => {
  assert.equal(normalizeCode(' abc234 '), 'ABC234');
  for (const raw of ['ABC23', 'ABC2345', 'ABC230', 'ABCI23', 'ABC-23']) assert.equal(normalizeCode(raw), null, raw);
});

const VALID: [string, unknown][] = [
  ['hello', { type: 'hello', sessionToken: 'a'.repeat(43) }],
  ['time:ping', { type: 'time:ping', clientTime: 1234.5 }],
  ['lobby:leave', { type: 'lobby:leave' }],
  ['lobby:lock', { type: 'lobby:lock', locked: true }],
  ['player:kick', { type: 'player:kick', playerId: 'Abc_123-xyz' }],
  ['settings:update', { type: 'settings:update', settings }],
  ['clip:report', { type: 'clip:report', number: 3, reason: 'wrong-song' }],
  ['reaction', { type: 'reaction', kind: 'facepalm' }],
];

for (const [name, message] of VALID) {
  test(`reads a ${name} message`, () => {
    assert.deepEqual(parseClientMessage(JSON.stringify(message), bounds), message);
  });
}

const INVALID: [string, string][] = [
  ['text that is not JSON', 'hello'],
  ['a JSON array', '[]'],
  ['an unknown type', JSON.stringify({ type: 'lobby:delete' })],
  ['a missing field', JSON.stringify({ type: 'hello' })],
  ['an extra field', JSON.stringify({ type: 'lobby:leave', now: true })],
  ['a token of the wrong type', JSON.stringify({ type: 'hello', sessionToken: 42 })],
  ['an overlong token', JSON.stringify({ type: 'hello', sessionToken: 'a'.repeat(65) })],
  ['a time that is not a number', JSON.stringify({ type: 'time:ping', clientTime: '1' })],
  ['a lock that is not a boolean', JSON.stringify({ type: 'lobby:lock', locked: 'yes' })],
  ['a player id with other characters', JSON.stringify({ type: 'player:kick', playerId: '../x' })],
  ['a reaction outside the set', JSON.stringify({ type: 'reaction', kind: 'lol' })],
  ['a reaction with text', JSON.stringify({ type: 'reaction', kind: 'heart', text: 'gg' })],
  ['a report of round 0', JSON.stringify({ type: 'clip:report', number: 0, reason: 'silent' })],
  ['a report past the last round', JSON.stringify({ type: 'clip:report', number: 51, reason: 'silent' })],
  ['a report with free text', JSON.stringify({ type: 'clip:report', number: 1, reason: 'it was loud' })],
  ['invalid settings', JSON.stringify({ type: 'settings:update', settings: { ...settings, songsPerGame: 500 } })],
];

for (const [name, text] of INVALID) {
  test(`refuses ${name}`, () => {
    assert.equal(parseClientMessage(text, bounds), null);
  });
}
