import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogger } from '../../server/log.ts';

test('writes one JSON line per event at or above the level', () => {
  const lines: string[] = [];
  const log = createLogger(
    'info',
    (line) => lines.push(line),
    () => new Date('2026-09-29T12:00:00Z'),
  );
  log.debug('hidden');
  log.info('lobby.created', { code: 'ABC234' });
  log.error('http.error', { message: 'boom' });
  assert.deepEqual(
    lines.map((line) => JSON.parse(line)),
    [
      { time: '2026-09-29T12:00:00.000Z', level: 'info', event: 'lobby.created', code: 'ABC234' },
      { time: '2026-09-29T12:00:00.000Z', level: 'error', event: 'http.error', message: 'boom' },
    ],
  );
});
